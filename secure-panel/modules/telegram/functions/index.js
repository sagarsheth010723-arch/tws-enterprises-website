import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!getApps().length) initializeApp();
const db = getFirestore();
const encryptionKey = defineSecret("TELEGRAM_TOKEN_ENCRYPTION_KEY");
const REGION = "asia-south1";
const CONFIG = db.doc("securePanelTelegram/config");
const CHANNELS = CONFIG.collection("channels");
const SETTINGS = CONFIG.collection("settings").doc("preferences");
const DIRECTOR_PROFILE = db.doc("securePanelUsers/CfcTen6kMHObMMQjcWHiwizt6Fz2");

function requireString(value, field, maxLength = 4096) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is required and has an invalid length.`);
  }
  return value.trim();
}

async function assertDirector(request) {
  if (!request.auth?.uid || request.auth.token.email !== "director@twsenterprises.in") {
    throw new HttpsError("permission-denied", "Director authentication is required.");
  }
  const profile = await DIRECTOR_PROFILE.get();
  if (!profile.exists || profile.data().role !== "director" || profile.data().isActive !== true) {
    throw new HttpsError("permission-denied", "Director authorisation could not be verified.");
  }
}

function encryptionMaterial() {
  const value = encryptionKey.value();
  if (!value) throw new HttpsError("failed-precondition", "Telegram encryption secret is not configured.");
  return createHash("sha256").update(value, "utf8").digest();
}

function encryptToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionMaterial(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

function decryptToken(payload) {
  if (!payload?.ciphertext || !payload?.iv || !payload?.tag) throw new HttpsError("failed-precondition", "Telegram bot token is not configured.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionMaterial(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

async function telegramRequest(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const detail = data?.description || "Telegram rejected this request.";
    throw new HttpsError("failed-precondition", detail);
  }
  return data.result;
}

async function configuredToken() {
  const snapshot = await CONFIG.get();
  return { data: snapshot.data() || {}, token: decryptToken(snapshot.data()?.tokenEncrypted) };
}

function channelDocumentId(channelId) {
  return createHash("sha256").update(channelId).digest("hex");
}

async function verifyAndStoreChannel(channelId) {
  const { token } = await configuredToken();
  const chat = await telegramRequest(token, "getChat", { chat_id: channelId });
  const record = {
    channelId,
    title: String(chat.title || chat.username || channelId),
    username: chat.username || null,
    type: chat.type || "channel",
    verified: true,
    verifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await CHANNELS.doc(channelDocumentId(channelId)).set(record, { merge: true });
  return record;
}

async function status() {
  const snapshot = await CONFIG.get();
  const data = snapshot.data() || {};
  return { configured: Boolean(data.tokenEncrypted), bot: data.bot || null, updatedAt: data.updatedAt?.toDate?.().toISOString?.() || null };
}

export const securePanelTelegram = onCall({ region: REGION, secrets: [encryptionKey] }, async (request) => {
  await assertDirector(request);
  const action = requireString(request.data?.action, "action", 64);

  if (action === "status") return status();
  if (action === "configureBot") {
    const token = requireString(request.data?.token, "token", 512);
    const bot = await telegramRequest(token, "getMe");
    await CONFIG.set({
      tokenEncrypted: encryptToken(token),
      bot: { id: bot.id, username: bot.username || null, firstName: bot.first_name || null },
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    }, { merge: true });
    return status();
  }
  if (action === "listChannels") {
    const snapshot = await CHANNELS.orderBy("title").get();
    return snapshot.docs.map((item) => item.data());
  }
  if (action === "addChannel" || action === "verifyChannel") {
    const channelId = requireString(request.data?.channelId, "channelId", 100);
    const record = await verifyAndStoreChannel(channelId);
    return { channel: record, message: "Channel verified." };
  }
  if (action === "deleteChannel") {
    const channelId = requireString(request.data?.channelId, "channelId", 100);
    await CHANNELS.doc(channelDocumentId(channelId)).delete();
    return { message: "Channel removed." };
  }
  if (action === "sendTestMessage") {
    const channelId = requireString(request.data?.channelId, "channelId", 100);
    const message = requireString(request.data?.message, "message", 4096);
    const { token } = await configuredToken();
    const result = await telegramRequest(token, "sendMessage", { chat_id: channelId, text: message });
    return { message: "Test message sent.", messageId: result.message_id };
  }
  if (action === "getSettings") {
    const snapshot = await SETTINGS.get();
    return { notificationsEnabled: snapshot.data()?.notificationsEnabled !== false };
  }
  if (action === "updateSettings") {
    const notificationsEnabled = request.data?.settings?.notificationsEnabled !== false;
    await SETTINGS.set({ notificationsEnabled, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid }, { merge: true });
    return { notificationsEnabled };
  }
  throw new HttpsError("invalid-argument", "Unknown Telegram action.");
});
