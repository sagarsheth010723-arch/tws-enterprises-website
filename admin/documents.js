import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
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

const { user: currentAdmin } = await mountAdminPage({ activePage: "documents", title: "Documents" });

let clients = new Map();
let records = [];
let unsubscribeUsers;
let unsubscribeDocuments;

const body = document.getElementById("documentTableBody");
const search = document.getElementById("documentSearch");
const statusFilter = document.getElementById("documentStatusFilter");
const visibilityFilter = document.getElementById("documentVisibilityFilter");
const dialog = document.getElementById("documentDialog");
const form = document.getElementById("documentForm");
const clientSelect = document.getElementById("documentClientSelect");

function clientIdFor(item) {
  return item.clientId || item.ref?.parent?.parent?.id || "";
}

function dateText(value) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return formatDate(value, false);
}

function statusClass(value) {
  return String(value || "requested").toLowerCase().replace(/[^a-z]+/g, "-");
}

function timestampNumber(value) {
  if (value?.seconds) return value.seconds;
  if (typeof value?.toDate === "function") return value.toDate().getTime() / 1000;
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed / 1000;
}

function populateClients() {
  const currentValue = clientSelect.value;
  const sorted = [...clients.entries()].sort((a, b) => getClientName(a[1]).localeCompare(getClientName(b[1])));
  clientSelect.innerHTML = '<option value="">Select client</option>' + sorted.map(([id, data]) => `<option value="${escapeHtml(id)}">${escapeHtml(getClientName(data))} — ${escapeHtml(data.email || data.mobile || id)}</option>`).join("");
  if (clients.has(currentValue)) clientSelect.value = currentValue;
}

function renderMetrics() {
  document.getElementById("documentTotal").textContent = records.length.toLocaleString("en-IN");
  document.getElementById("documentVerified").textContent = records.filter((item) => String(item.documentStatus || "requested").toLowerCase() === "verified").length.toLocaleString("en-IN");
  document.getElementById("documentVisible").textContent = records.filter((item) => item.clientVisible === true).length.toLocaleString("en-IN");
  document.getElementById("documentAction").textContent = records.filter((item) => ["requested", "rejected"].includes(String(item.documentStatus || "requested").toLowerCase())).length.toLocaleString("en-IN");
}

function filteredRecords() {
  const term = search.value.trim().toLowerCase();
  const status = statusFilter.value;
  const visibility = visibilityFilter.value;
  return records.filter((item) => {
    const clientId = clientIdFor(item);
    const client = clients.get(clientId) || {};
    const haystack = `${getClientName(client)} ${client.email || ""} ${item.documentTitle || ""} ${item.documentType || ""}`.toLowerCase();
    const itemStatus = String(item.documentStatus || "requested").toLowerCase();
    const visibilityMatches = !visibility || (visibility === "visible" ? item.clientVisible === true : item.clientVisible !== true);
    return (!term || haystack.includes(term)) && (!status || itemStatus === status) && visibilityMatches;
  });
}

function renderTable() {
  const visible = filteredRecords();
  if (!visible.length) {
    body.innerHTML = '<tr><td colspan="7" class="table-empty">No matching document records found.</td></tr>';
    return;
  }
  body.innerHTML = visible.map((item) => {
    const clientId = clientIdFor(item);
    const client = clients.get(clientId) || {};
    const status = String(item.documentStatus || "requested").toLowerCase();
    const updated = item.updatedAt || item.createdAt;
    const link = item.documentUrl ? `<a class="table-action" href="${escapeHtml(item.documentUrl)}" target="_blank" rel="noopener">Open</a>` : "";
    return `<tr>
      <td><a class="table-primary-link" href="./client-profile.html?id=${encodeURIComponent(clientId)}&tab=documents">${escapeHtml(getClientName(client))}</a><small>${escapeHtml(client.email || client.mobile || clientId)}</small></td>
      <td><strong>${escapeHtml(item.documentTitle || "Untitled document")}</strong><small>${escapeHtml(item.documentType || "—")}</small></td>
      <td><span class="status-badge ${escapeHtml(statusClass(status))}">${escapeHtml(status)}</span></td>
      <td><span class="visibility-pill ${item.clientVisible === true ? "visible" : "hidden"}">${item.clientVisible === true ? "Client visible" : "Admin only"}</span></td>
      <td><strong>${escapeHtml(dateText(item.issueDate))}</strong><small>Expiry: ${escapeHtml(dateText(item.documentExpiryDate))}</small></td>
      <td>${escapeHtml(formatDate(updated))}</td>
      <td><div class="table-actions">${link}<button class="table-action" type="button" data-edit-document="${escapeHtml(item.path)}">Edit</button><button class="table-action danger" type="button" data-delete-document="${escapeHtml(item.path)}">Delete</button></div></td>
    </tr>`;
  }).join("");

  body.querySelectorAll("[data-edit-document]").forEach((button) => button.addEventListener("click", () => openEditDialog(button.dataset.editDocument)));
  body.querySelectorAll("[data-delete-document]").forEach((button) => button.addEventListener("click", () => removeDocument(button.dataset.deleteDocument)));
}

function renderAll() {
  renderMetrics();
  renderTable();
}

function resetForm() {
  form.reset();
  form.elements.recordPath.value = "";
  form.elements.documentStatus.value = "requested";
  clientSelect.disabled = false;
  setInlineMessage(document.getElementById("documentFormMessage"));
}

function openNewDialog() {
  resetForm();
  document.getElementById("documentDialogEyebrow").textContent = "ADD DOCUMENT";
  document.getElementById("documentDialogTitle").textContent = "Add document record";
  document.getElementById("saveDocumentButton").textContent = "Save document";
  dialog.showModal();
}

function openEditDialog(path) {
  const item = records.find((record) => record.path === path);
  if (!item) return;
  resetForm();
  form.elements.recordPath.value = item.path;
  form.elements.clientId.value = clientIdFor(item);
  clientSelect.disabled = true;
  form.elements.documentType.value = item.documentType || "";
  form.elements.documentStatus.value = item.documentStatus || "requested";
  form.elements.documentTitle.value = item.documentTitle || "";
  form.elements.documentUrl.value = item.documentUrl || "";
  form.elements.issueDate.value = typeof item.issueDate === "string" ? item.issueDate : "";
  form.elements.documentExpiryDate.value = typeof item.documentExpiryDate === "string" ? item.documentExpiryDate : "";
  form.elements.clientVisible.checked = item.clientVisible === true;
  form.elements.documentNotes.value = item.documentNotes || "";
  document.getElementById("documentDialogEyebrow").textContent = "EDIT DOCUMENT";
  document.getElementById("documentDialogTitle").textContent = item.documentTitle || "Edit document";
  document.getElementById("saveDocumentButton").textContent = "Update document";
  dialog.showModal();
}

async function removeDocument(path) {
  const item = records.find((record) => record.path === path);
  if (!item) return;
  if (!window.confirm(`Delete ${item.documentTitle || "this document"}?`)) return;
  const clientId = clientIdFor(item);
  try {
    await deleteDoc(doc(db, path));
    const batch = writeBatch(db);
    const activityRef = doc(collection(db, "users", clientId, "activity_logs"));
    batch.set(activityRef, {
      action: "document_deleted",
      description: `${item.documentTitle || "Document"} was deleted from the Documents module.`,
      metadata: { documentId: item.id },
      createdAt: serverTimestamp(),
      createdBy: currentAdmin.email || ""
    });
    await batch.commit();
  } catch (error) {
    window.alert(error.message || "Document could not be deleted.");
  }
}

document.getElementById("addDocumentButton").addEventListener("click", openNewDialog);
search.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);
visibilityFilter.addEventListener("change", renderTable);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const path = String(data.get("recordPath") || "");
  const existingRecord = path ? records.find((record) => record.path === path) : null;
  const clientId = path ? clientIdFor(existingRecord || {}) : String(data.get("clientId") || "");
  const documentTitle = String(data.get("documentTitle") || "").trim();
  const documentType = String(data.get("documentType") || "").trim();
  const clientVisible = form.elements.clientVisible.checked;
  const message = document.getElementById("documentFormMessage");
  const saveButton = document.getElementById("saveDocumentButton");

  if (!clientId || !documentTitle || !documentType) {
    setInlineMessage(message, "Client, document type and title are required.", "error");
    return;
  }

  saveButton.disabled = true;
  setInlineMessage(message, path ? "Updating document…" : "Saving document…", "info");
  try {
    const batch = writeBatch(db);
    const documentRef = path ? doc(db, path) : doc(collection(db, "users", clientId, "documents"));
    const payload = {
      documentTitle,
      documentType,
      documentStatus: String(data.get("documentStatus") || "requested"),
      documentUrl: String(data.get("documentUrl") || "").trim(),
      issueDate: String(data.get("issueDate") || ""),
      documentExpiryDate: String(data.get("documentExpiryDate") || ""),
      clientVisible,
      documentNotes: String(data.get("documentNotes") || "").trim(),
      updatedAt: serverTimestamp(),
      updatedBy: currentAdmin.email || ""
    };
    if (path) batch.update(documentRef, payload);
    else batch.set(documentRef, { ...payload, createdAt: serverTimestamp(), createdBy: currentAdmin.email || "" });

    if (clientVisible) {
      const notificationRef = doc(collection(db, "notifications", clientId, "items"));
      batch.set(notificationRef, {
        targetUserId: clientId,
        title: path ? "Statement Updated" : "New Statement Available",
        message: `${documentTitle} is now available in the Statements section of TWS Connect.`,
        type: path ? "document_updated" : "document_added",
        documentId: documentRef.id,
        isRead: false,
        createdAt: serverTimestamp()
      });
    }

    const activityRef = doc(collection(db, "users", clientId, "activity_logs"));
    batch.set(activityRef, {
      action: path ? "document_updated" : "document_added",
      description: path ? `${documentTitle} was updated from the Documents module.` : `${documentTitle} was added from the Documents module.`,
      metadata: { documentId: documentRef.id, documentType, clientVisible },
      createdAt: serverTimestamp(),
      createdBy: currentAdmin.email || ""
    });
    await batch.commit();
    setInlineMessage(message, clientVisible ? "Document saved and client notified." : "Document saved successfully.", "success");
    setTimeout(() => dialog.close(), 550);
  } catch (error) {
    setInlineMessage(message, error.message || "Document could not be saved.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  clients = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  populateClients();
  renderTable();
}, (error) => console.warn("Users listener failed:", error));

unsubscribeDocuments = onSnapshot(collectionGroup(db, "documents"), (snapshot) => {
  records = snapshot.docs.map((item) => ({ id: item.id, path: item.ref.path, ref: item.ref, clientId: item.ref.parent.parent?.id || "", ...item.data() }))
    .sort((a, b) => timestampNumber(b.updatedAt || b.createdAt) - timestampNumber(a.updatedAt || a.createdAt));
  renderAll();
}, (error) => {
  console.error("Documents listener failed:", error);
  body.innerHTML = '<tr><td colspan="7" class="table-empty">Document records could not be loaded.</td></tr>';
});

window.addEventListener("beforeunload", () => {
  unsubscribeUsers?.();
  unsubscribeDocuments?.();
});
