import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./firebase.js";

const STORAGE_KEY = "tws-secure-panel-session-id";
let heartbeatTimer;

function currentSession() {
  const existingId = sessionStorage.getItem(STORAGE_KEY);
  if (existingId) return { id: existingId, isNew: false };
  const id = crypto.randomUUID();
  sessionStorage.setItem(STORAGE_KEY, id);
  return { id, isNew: true };
}

export async function startSession(user, profile) {
  const { id, isNew } = currentSession();
  const reference = doc(db, "securePanelSessions", id);
  if (!isNew) {
    try {
      await updateDoc(reference, { isActive: true, lastActivityAt: serverTimestamp(), endedAt: null });
      startHeartbeat();
      return id;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return startSession(user, profile);
    }
  }
  await setDoc(reference, {
    uid: user.uid,
    email: user.email,
    role: profile.role,
    isActive: true,
    startedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    endedAt: null
  }, { merge: true });
  startHeartbeat();
  return id;
}

export async function recordActivity() {
  const id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) return;
  await updateDoc(doc(db, "securePanelSessions", id), { lastActivityAt: serverTimestamp(), isActive: true });
}

function startHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => recordActivity().catch(() => {}), 300000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recordActivity().catch(() => {});
  }, { once: true });
}

export async function endSession() {
  clearInterval(heartbeatTimer);
  const id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) return;
  await updateDoc(doc(db, "securePanelSessions", id), { isActive: false, endedAt: serverTimestamp(), lastActivityAt: serverTimestamp() });
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function getUserSessions(uid) {
  const snapshots = await getDocs(query(collection(db, "securePanelSessions"), where("uid", "==", uid)));
  return snapshots.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
}
