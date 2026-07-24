import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./admin-auth.js";
import {
  amount,
  escapeHtml,
  formatCurrency,
  getClientName,
  mountAdminPage,
  setInlineMessage
} from "./admin-layout.js";

const { user: currentAdmin } = await mountAdminPage({ activePage: "services", title: "Services" });

const allowedServices = new Set([
  "Portfolio Management Service",
  "Wealth Management",
  "Compounding Strategy"
]);

let clients = new Map();
let records = [];
let visibleRecords = [];
let unsubscribeUsers;
let unsubscribeServices;

const body = document.getElementById("serviceTableBody");
const search = document.getElementById("serviceSearch");
const statusFilter = document.getElementById("serviceStatusFilter");
const dialog = document.getElementById("serviceDialog");
const form = document.getElementById("serviceForm");

function dateKey(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value?.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function clientFor(clientId) {
  return clients.get(clientId) || {};
}

function statusClass(value) {
  return String(value || "pending").toLowerCase().replace(/[^a-z]+/g, "-");
}

function serviceClientId(item) {
  return item.clientId || item.ref?.parent?.parent?.id || "";
}

function renderMetrics() {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 86400000);
  const active = records.filter((item) => String(item.serviceStatus || "pending").toLowerCase() === "active").length;
  const attention = records.filter((item) => ["pending", "paused"].includes(String(item.serviceStatus || "pending").toLowerCase())).length;
  const expiring = records.filter((item) => {
    const value = item.expiryDate ? new Date(`${dateKey(item.expiryDate)}T23:59:59`) : null;
    return value && !Number.isNaN(value.getTime()) && value >= now && value <= thirtyDays;
  }).length;
  document.getElementById("serviceTotal").textContent = records.length.toLocaleString("en-IN");
  document.getElementById("serviceActive").textContent = active.toLocaleString("en-IN");
  document.getElementById("serviceAttention").textContent = attention.toLocaleString("en-IN");
  document.getElementById("serviceExpiring").textContent = expiring.toLocaleString("en-IN");
}

function applyFilters() {
  const term = search.value.trim().toLowerCase();
  const status = statusFilter.value;
  visibleRecords = records.filter((item) => {
    const clientId = serviceClientId(item);
    const client = clientFor(clientId);
    const haystack = `${getClientName(client)} ${client.email || ""} ${item.serviceName || ""}`.toLowerCase();
    const itemStatus = String(item.serviceStatus || "pending").toLowerCase();
    return (!term || haystack.includes(term)) && (!status || itemStatus === status);
  });
  renderTable();
}

function renderTable() {
  if (!visibleRecords.length) {
    body.innerHTML = '<tr><td colspan="8" class="table-empty">No matching service assignments found.</td></tr>';
    return;
  }
  body.innerHTML = visibleRecords.map((item) => {
    const clientId = serviceClientId(item);
    const client = clientFor(clientId);
    const status = String(item.serviceStatus || "pending").toLowerCase();
    return `<tr>
      <td><a class="table-primary-link" href="./client-profile.html?id=${encodeURIComponent(clientId)}&tab=services">${escapeHtml(getClientName(client))}</a><small>${escapeHtml(client.email || client.mobile || clientId)}</small></td>
      <td><strong>${escapeHtml(item.serviceName || "—")}</strong><small>${escapeHtml(item.assignedAdvisor || "No advisor assigned")}</small></td>
      <td><span class="status-badge ${escapeHtml(statusClass(status))}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(dateKey(item.startDate) || "—")}</td>
      <td>${escapeHtml(dateKey(item.expiryDate) || "—")}</td>
      <td>${escapeHtml(formatCurrency(item.investmentAmount))}</td>
      <td>${escapeHtml(formatCurrency(item.serviceFee))}</td>
      <td><button class="table-action" type="button" data-edit-service="${escapeHtml(item.path)}">Edit</button></td>
    </tr>`;
  }).join("");
  body.querySelectorAll("[data-edit-service]").forEach((button) => {
    button.addEventListener("click", () => openDialog(button.dataset.editService));
  });
}

function openDialog(path) {
  const item = records.find((record) => record.path === path);
  if (!item) return;
  form.reset();
  form.elements.recordPath.value = item.path;
  form.elements.clientId.value = serviceClientId(item);
  form.elements.status.value = item.serviceStatus || "pending";
  form.elements.expiryDate.value = dateKey(item.expiryDate);
  form.elements.investmentAmount.value = item.investmentAmount ?? "";
  form.elements.serviceFee.value = item.serviceFee ?? "";
  form.elements.assignedAdvisor.value = item.assignedAdvisor || "";
  form.elements.internalRemarks.value = item.internalRemarks || "";
  document.getElementById("serviceDialogTitle").textContent = item.serviceName || "Service assignment";
  setInlineMessage(document.getElementById("serviceFormMessage"));
  dialog.showModal();
}

async function logActivity(clientId, action, description, metadata = {}) {
  if (!clientId) return;
  await addDoc(collection(db, "users", clientId, "activity_logs"), {
    action,
    description,
    metadata,
    createdAt: serverTimestamp(),
    createdBy: currentAdmin.email || ""
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const path = String(data.get("recordPath") || "");
  const clientId = String(data.get("clientId") || "");
  const status = String(data.get("status") || "pending");
  const investmentAmount = amount(data.get("investmentAmount"));
  const serviceFee = amount(data.get("serviceFee"));
  const message = document.getElementById("serviceFormMessage");
  const saveButton = document.getElementById("saveServiceButton");
  if (!path || !clientId) {
    setInlineMessage(message, "Service record could not be identified.", "error");
    return;
  }
  saveButton.disabled = true;
  setInlineMessage(message, "Saving service assignment…", "info");
  try {
    await updateDoc(doc(db, path), {
      serviceStatus: status,
      expiryDate: String(data.get("expiryDate") || ""),
      investmentAmount,
      serviceFee,
      assignedAdvisor: String(data.get("assignedAdvisor") || "").trim(),
      internalRemarks: String(data.get("internalRemarks") || "").trim(),
      updatedAt: serverTimestamp(),
      updatedBy: currentAdmin.email || ""
    });
    await logActivity(clientId, "service_assignment_updated", "Service assignment was updated from the Services module.", { status, investmentAmount, serviceFee });
    setInlineMessage(message, "Service updated successfully.", "success");
    setTimeout(() => dialog.close(), 500);
  } catch (error) {
    setInlineMessage(message, error.message || "Service could not be updated.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

search.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);
document.getElementById("serviceRefresh").addEventListener("click", applyFilters);

unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  clients = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  applyFilters();
}, (error) => console.warn("Clients listener failed:", error));

unsubscribeServices = onSnapshot(collectionGroup(db, "services"), (snapshot) => {
  records = snapshot.docs
    .map((item) => ({ id: item.id, path: item.ref.path, ref: item.ref, clientId: item.ref.parent.parent?.id || "", ...item.data() }))
    .filter((item) => allowedServices.has(item.serviceName))
    .sort((a, b) => String(b.updatedAt?.seconds || b.createdAt?.seconds || 0).localeCompare(String(a.updatedAt?.seconds || a.createdAt?.seconds || 0)));
  renderMetrics();
  applyFilters();
}, (error) => {
  console.error("Services listener failed:", error);
  body.innerHTML = '<tr><td colspan="8" class="table-empty">Service assignments could not be loaded.</td></tr>';
});

window.addEventListener("beforeunload", () => {
  unsubscribeUsers?.();
  unsubscribeServices?.();
});
