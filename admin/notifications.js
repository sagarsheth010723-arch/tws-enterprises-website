import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./admin-auth.js";
import {
  escapeHtml,
  formatDate,
  getClientName,
  mountAdminPage,
  setInlineMessage
} from "./admin-layout.js";

const { user: currentAdmin } = await mountAdminPage({ activePage: "notifications", title: "Notifications" });

const INDIA_OFFSET_MS = 330 * 60 * 1000;
let clients = new Map();
let records = [];
let unsubscribeUsers;
let unsubscribeNotifications;

const body = document.getElementById("notificationTableBody");
const search = document.getElementById("notificationSearch");
const statusFilter = document.getElementById("notificationStatusFilter");
const typeFilter = document.getElementById("notificationTypeFilter");
const dialog = document.getElementById("notificationDialog");
const form = document.getElementById("notificationForm");
const clientSelect = document.getElementById("notificationClientSelect");

function indiaDateKey(value = new Date()) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value || Date.now());
  return new Date(date.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

function timestampNumber(value) {
  if (value?.seconds) return value.seconds;
  if (typeof value?.toDate === "function") return value.toDate().getTime() / 1000;
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed / 1000;
}

function clientIdFor(item) {
  return item.targetUserId || item.clientId || item.ref?.parent?.parent?.id || "";
}

function populateClients() {
  const current = clientSelect.value;
  const sorted = [...clients.entries()].sort((a, b) => getClientName(a[1]).localeCompare(getClientName(b[1])));
  clientSelect.innerHTML = '<option value="">Select client</option>' + sorted.map(([id, data]) => `<option value="${escapeHtml(id)}">${escapeHtml(getClientName(data))} — ${escapeHtml(data.email || data.mobile || id)}</option>`).join("");
  if (clients.has(current)) clientSelect.value = current;
}

function populateTypes() {
  const current = typeFilter.value;
  const types = [...new Set(records.map((item) => String(item.type || "general")))].sort();
  typeFilter.innerHTML = '<option value="">All types</option>' + types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type.replace(/_/g, " "))}</option>`).join("");
  if (types.includes(current)) typeFilter.value = current;
}

function renderMetrics() {
  const today = indiaDateKey();
  document.getElementById("notificationTotal").textContent = records.length.toLocaleString("en-IN");
  document.getElementById("notificationUnread").textContent = records.filter((item) => item.isRead !== true).length.toLocaleString("en-IN");
  document.getElementById("notificationToday").textContent = records.filter((item) => indiaDateKey(item.createdAt) === today).length.toLocaleString("en-IN");
  document.getElementById("notificationClients").textContent = new Set(records.map(clientIdFor).filter(Boolean)).size.toLocaleString("en-IN");
}

function filteredRecords() {
  const term = search.value.trim().toLowerCase();
  const status = statusFilter.value;
  const type = typeFilter.value;
  return records.filter((item) => {
    const clientId = clientIdFor(item);
    const client = clients.get(clientId) || {};
    const haystack = `${getClientName(client)} ${client.email || ""} ${item.title || ""} ${item.message || ""}`.toLowerCase();
    const isRead = item.isRead === true;
    const statusMatches = !status || (status === "read" ? isRead : !isRead);
    return (!term || haystack.includes(term)) && statusMatches && (!type || String(item.type || "general") === type);
  });
}

function renderTable() {
  const visible = filteredRecords();
  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="6" class="table-empty">No matching notifications found.</td></tr>';
    return;
  }
  body.innerHTML = visible.map((item) => {
    const clientId = clientIdFor(item);
    const client = clients.get(clientId) || {};
    const type = String(item.type || "general");
    const read = item.isRead === true;
    return `<tr>
      <td><a class="table-primary-link" href="./client-profile.html?id=${encodeURIComponent(clientId)}">${escapeHtml(getClientName(client))}</a><small>${escapeHtml(client.email || client.mobile || clientId)}</small></td>
      <td><strong>${escapeHtml(item.title || "Notification")}</strong><small class="table-message">${escapeHtml(item.message || "")}</small></td>
      <td><span class="type-pill">${escapeHtml(type.replace(/_/g, " "))}</span></td>
      <td><span class="status-badge ${read ? "active" : "pending"}">${read ? "Read" : "Unread"}</span></td>
      <td>${escapeHtml(formatDate(item.createdAt))}</td>
      <td><div class="table-actions"><button class="table-action" type="button" data-toggle-read="${escapeHtml(item.path)}">Mark ${read ? "unread" : "read"}</button><button class="table-action danger" type="button" data-delete-notification="${escapeHtml(item.path)}">Delete</button></div></td>
    </tr>`;
  }).join("");
  body.querySelectorAll("[data-toggle-read]").forEach((button) => button.addEventListener("click", () => toggleRead(button.dataset.toggleRead)));
  body.querySelectorAll("[data-delete-notification]").forEach((button) => button.addEventListener("click", () => removeNotification(button.dataset.deleteNotification)));
}

function renderAll() {
  populateTypes();
  renderMetrics();
  renderTable();
}

async function toggleRead(path) {
  const item = records.find((record) => record.path === path);
  if (!item) return;
  try {
    await updateDoc(doc(db, path), { isRead: item.isRead !== true, updatedAt: serverTimestamp(), updatedBy: currentAdmin.email || "" });
  } catch (error) {
    window.alert(error.message || "Notification status could not be updated.");
  }
}

async function removeNotification(path) {
  const item = records.find((record) => record.path === path);
  if (!item) return;
  if (!window.confirm(`Delete notification: ${item.title || "Notification"}?`)) return;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    window.alert(error.message || "Notification could not be deleted.");
  }
}

document.getElementById("composeNotificationButton").addEventListener("click", () => {
  form.reset();
  setInlineMessage(document.getElementById("notificationFormMessage"));
  dialog.showModal();
});
search.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);
typeFilter.addEventListener("change", renderTable);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const clientId = String(data.get("clientId") || "");
  const title = String(data.get("title") || "").trim();
  const messageText = String(data.get("message") || "").trim();
  const type = String(data.get("type") || "general");
  const message = document.getElementById("notificationFormMessage");
  const sendButton = document.getElementById("sendNotificationButton");
  if (!clientId || !title || !messageText) {
    setInlineMessage(message, "Client, title and message are required.", "error");
    return;
  }
  sendButton.disabled = true;
  setInlineMessage(message, "Sending notification…", "info");
  try {
    const batch = writeBatch(db);
    const notificationRef = doc(collection(db, "notifications", clientId, "items"));
    batch.set(notificationRef, {
      targetUserId: clientId,
      title,
      message: messageText,
      type,
      isRead: false,
      createdAt: serverTimestamp(),
      createdBy: currentAdmin.email || ""
    });
    const activityRef = doc(collection(db, "users", clientId, "activity_logs"));
    batch.set(activityRef, {
      action: "notification_sent",
      description: `${title} notification was sent from the Notifications module.`,
      metadata: { notificationId: notificationRef.id, type },
      createdAt: serverTimestamp(),
      createdBy: currentAdmin.email || ""
    });
    await batch.commit();
    setInlineMessage(message, "Notification sent successfully.", "success");
    setTimeout(() => dialog.close(), 500);
  } catch (error) {
    setInlineMessage(message, error.message || "Notification could not be sent.", "error");
  } finally {
    sendButton.disabled = false;
  }
});

unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  clients = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  populateClients();
  renderTable();
}, (error) => console.warn("Users listener failed:", error));

unsubscribeNotifications = onSnapshot(collectionGroup(db, "items"), (snapshot) => {
  records = snapshot.docs
    .filter((item) => item.ref.path.startsWith("notifications/"))
    .map((item) => ({ id: item.id, path: item.ref.path, ref: item.ref, clientId: item.ref.parent.parent?.id || "", ...item.data() }))
    .sort((a, b) => timestampNumber(b.createdAt) - timestampNumber(a.createdAt));
  renderAll();
}, (error) => {
  console.error("Notifications listener failed:", error);
  body.innerHTML = '<tr><td colspan="6" class="table-empty">Notifications could not be loaded.</td></tr>';
});

window.addEventListener("beforeunload", () => {
  unsubscribeUsers?.();
  unsubscribeNotifications?.();
});
