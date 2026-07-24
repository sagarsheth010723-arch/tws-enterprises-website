import {
  collection,
  collectionGroup,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./admin-auth.js";
import {
  downloadCsv,
  escapeHtml,
  formatDate,
  getClientName,
  mountAdminPage,
  setInlineMessage,
  valueDate
} from "./admin-layout.js";

await mountAdminPage({ activePage: "activity", title: "Activity Logs" });

const INDIA_OFFSET_MS = 330 * 60 * 1000;
let clients = new Map();
let records = [];
let unsubscribeUsers;
let unsubscribeActivity;

const body = document.getElementById("activityTableBody");
const search = document.getElementById("activitySearch");
const actionFilter = document.getElementById("activityActionFilter");
const dateFilter = document.getElementById("activityDateFilter");
const message = document.getElementById("activityMessage");

function indiaDateKey(value = new Date()) {
  const date = valueDate(value) || new Date();
  return new Date(date.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

function timestampNumber(value) {
  const date = valueDate(value);
  return date ? date.getTime() : 0;
}

function clientIdFor(item) {
  return item.clientId || item.ref?.parent?.parent?.id || "";
}

function populateActions() {
  const current = actionFilter.value;
  const actions = [...new Set(records.map((item) => String(item.action || "unknown")))].sort();
  actionFilter.innerHTML = '<option value="">All actions</option>' + actions.map((action) => `<option value="${escapeHtml(action)}">${escapeHtml(action.replace(/_/g, " "))}</option>`).join("");
  if (actions.includes(current)) actionFilter.value = current;
}

function renderMetrics() {
  const today = indiaDateKey();
  document.getElementById("activityTotal").textContent = records.length.toLocaleString("en-IN");
  document.getElementById("activityToday").textContent = records.filter((item) => indiaDateKey(item.createdAt) === today).length.toLocaleString("en-IN");
  document.getElementById("activityTypes").textContent = new Set(records.map((item) => item.action).filter(Boolean)).size.toLocaleString("en-IN");
  document.getElementById("activityClients").textContent = new Set(records.map(clientIdFor).filter(Boolean)).size.toLocaleString("en-IN");
}

function filteredRecords() {
  const term = search.value.trim().toLowerCase();
  const action = actionFilter.value;
  const date = dateFilter.value;
  return records.filter((item) => {
    const clientId = clientIdFor(item);
    const client = clients.get(clientId) || {};
    const haystack = `${getClientName(client)} ${client.email || ""} ${item.action || ""} ${item.description || ""} ${item.createdBy || ""}`.toLowerCase();
    return (!term || haystack.includes(term)) && (!action || String(item.action || "") === action) && (!date || indiaDateKey(item.createdAt) === date);
  });
}

function renderTable() {
  const visible = filteredRecords();
  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="5" class="table-empty">No matching activity records found.</td></tr>';
    return;
  }
  body.innerHTML = visible.map((item) => {
    const clientId = clientIdFor(item);
    const client = clients.get(clientId) || {};
    return `<tr>
      <td><strong>${escapeHtml(formatDate(item.createdAt))}</strong></td>
      <td><a class="table-primary-link" href="./client-profile.html?id=${encodeURIComponent(clientId)}&tab=activity">${escapeHtml(getClientName(client))}</a><small>${escapeHtml(client.email || client.mobile || clientId)}</small></td>
      <td><span class="type-pill">${escapeHtml(String(item.action || "unknown").replace(/_/g, " "))}</span></td>
      <td><span class="activity-description">${escapeHtml(item.description || "—")}</span></td>
      <td>${escapeHtml(item.createdBy || "—")}</td>
    </tr>`;
  }).join("");
}

function renderAll() {
  populateActions();
  renderMetrics();
  renderTable();
}

search.addEventListener("input", renderTable);
actionFilter.addEventListener("change", renderTable);
dateFilter.addEventListener("change", renderTable);

document.getElementById("exportActivityLogs").addEventListener("click", () => {
  const rows = filteredRecords().map((item) => {
    const clientId = clientIdFor(item);
    const client = clients.get(clientId) || {};
    return {
      Date_Time: formatDate(item.createdAt),
      Client_ID: clientId,
      Client_Name: getClientName(client),
      Action: item.action || "",
      Description: item.description || "",
      Admin: item.createdBy || "",
      Metadata: item.metadata ? JSON.stringify(item.metadata) : ""
    };
  });
  const success = downloadCsv(`TWS_Activity_Logs_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  setInlineMessage(message, success ? "Activity log exported." : "No activity records are available for export.", success ? "success" : "error");
});

unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  clients = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  renderTable();
}, (error) => console.warn("Users listener failed:", error));

unsubscribeActivity = onSnapshot(collectionGroup(db, "activity_logs"), (snapshot) => {
  records = snapshot.docs.map((item) => ({ id: item.id, ref: item.ref, clientId: item.ref.parent.parent?.id || "", ...item.data() }))
    .sort((a, b) => timestampNumber(b.createdAt) - timestampNumber(a.createdAt));
  renderAll();
}, (error) => {
  console.error("Activity log listener failed:", error);
  body.innerHTML = '<tr><td colspan="5" class="table-empty">Activity logs could not be loaded.</td></tr>';
});

window.addEventListener("beforeunload", () => {
  unsubscribeUsers?.();
  unsubscribeActivity?.();
});
