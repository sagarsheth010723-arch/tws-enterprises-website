import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./admin-auth.js";
import {
  amount,
  escapeHtml,
  formatCurrency,
  formatDate,
  getClientName,
  mountAdminPage,
  setInlineMessage
} from "./admin-layout.js";

const { user: currentAdmin } = await mountAdminPage({ activePage: "payments", title: "Payments" });

const INDIA_OFFSET_MS = 330 * 60 * 1000;
let clients = new Map();
let payments = new Map();
let dashboard = new Map();
let unsubscribeUsers;
let unsubscribePayments;
let unsubscribeDashboard;

const body = document.getElementById("paymentTableBody");
const search = document.getElementById("paymentSearch");
const statusFilter = document.getElementById("paymentStatusFilter");
const dialog = document.getElementById("paymentDialog");
const form = document.getElementById("paymentForm");
const pageTitle = document.getElementById("paymentPageTitle");
const pageSubtitle = document.getElementById("paymentPageSubtitle");
const viewBanner = document.getElementById("paymentViewBanner");
const viewTitle = document.getElementById("paymentViewTitle");
const viewDescription = document.getElementById("paymentViewDescription");
const clearViewButton = document.getElementById("clearPaymentView");

const VIEW_VALUES = new Set(["today", "pending"]);
let activeView = VIEW_VALUES.has(new URLSearchParams(window.location.search).get("view"))
  ? new URLSearchParams(window.location.search).get("view")
  : "";

function indiaDateKey(value = new Date()) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value || Date.now());
  return new Date(date.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

function recordDateKey(record = {}) {
  if (typeof record.todayCommissionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.todayCommissionDate)) return record.todayCommissionDate;
  return "";
}

function currentLabel() {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
}

function mergedRows() {
  return [...clients.entries()].map(([clientId, client]) => ({
    clientId,
    client,
    payment: payments.get(clientId) || {},
    dashboard: dashboard.get(clientId) || {}
  }));
}

function todayAmount(row) {
  const source = Object.keys(row.payment).length ? row.payment : row.dashboard;
  return recordDateKey(source) === indiaDateKey() ? amount(source.todayCommission) : 0;
}

function rowMatchesActiveView(row) {
  if (activeView === "today") return todayAmount(row) > 0;
  if (activeView === "pending") return amount(row.payment.totalPending) > 0;
  return true;
}

function activeViewAmount(row) {
  if (activeView === "today") return todayAmount(row);
  if (activeView === "pending") return amount(row.payment.totalPending);
  return 0;
}

function applyViewPresentation() {
  document.querySelectorAll("[data-payment-view]").forEach((card) => {
    card.classList.toggle("active", card.dataset.paymentView === activeView);
  });

  if (!activeView) {
    pageTitle.textContent = "Payments";
    pageSubtitle.textContent = "Update the same commission and payment values shown in the client app.";
    viewBanner.hidden = true;
    return;
  }

  const isToday = activeView === "today";
  pageTitle.textContent = isToday ? "Today's Commission Clients" : "Pending Commission Clients";
  pageSubtitle.textContent = isToday
    ? "Clients whose commission was entered for the current India date."
    : "Clients whose pending payment amount is above zero.";
  viewTitle.textContent = isToday ? "Today's commission" : "Pending commission";
  viewDescription.textContent = isToday
    ? "Only clients with a commission amount above ₹0 for today are shown. Use Update to edit any client."
    : "Only clients with an outstanding amount above ₹0 are shown. Use Update to edit any client.";
  viewBanner.hidden = false;
}

function setActiveView(nextView, { updateUrl = true } = {}) {
  activeView = VIEW_VALUES.has(nextView) ? nextView : "";
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (activeView) url.searchParams.set("view", activeView);
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  }
  applyViewPresentation();
  renderTable();
}

function initializeViewControls() {
  document.querySelectorAll("[data-payment-view]").forEach((card) => {
    const activate = () => setActiveView(card.dataset.paymentView);
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate();
    });
  });
  clearViewButton.addEventListener("click", () => setActiveView(""));
  applyViewPresentation();
}

function renderMetrics() {
  const rows = mergedRows();
  document.getElementById("paymentTodayCommission").textContent = formatCurrency(rows.reduce((sum, row) => sum + todayAmount(row), 0));
  document.getElementById("paymentTotalReceived").textContent = formatCurrency(rows.reduce((sum, row) => sum + amount(row.payment.totalPaid), 0));
  document.getElementById("paymentPendingAmount").textContent = formatCurrency(rows.reduce((sum, row) => sum + amount(row.payment.totalPending), 0));
  document.getElementById("paymentDueClients").textContent = rows.filter((row) => amount(row.payment.totalPending) > 0).length.toLocaleString("en-IN");
}

function renderTable() {
  const term = search.value.trim().toLowerCase();
  const filterStatus = statusFilter.value;
  const rows = mergedRows().filter((row) => {
    const haystack = `${getClientName(row.client)} ${row.client.email || ""} ${row.client.mobile || ""}`.toLowerCase();
    const status = String(row.payment.paymentStatus || row.dashboard.paymentStatus || "Not Available");
    return rowMatchesActiveView(row)
      && (!term || haystack.includes(term))
      && (!filterStatus || status === filterStatus);
  }).sort((a, b) => {
    if (activeView) {
      const amountDifference = activeViewAmount(b) - activeViewAmount(a);
      if (amountDifference !== 0) return amountDifference;
    }
    return getClientName(a.client).localeCompare(getClientName(b.client));
  });

  if (!rows.length) {
    const emptyMessage = activeView === "today"
      ? "No client has today's commission above ₹0."
      : activeView === "pending"
        ? "No client currently has pending commission."
        : "No matching payment records found.";
    body.innerHTML = `<tr><td colspan="7" class="table-empty">${escapeHtml(emptyMessage)}</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((row) => {
    const status = String(row.payment.paymentStatus || row.dashboard.paymentStatus || "Not Available");
    const updatedAt = row.payment.updatedAt || row.dashboard.updatedAt;
    return `<tr>
      <td><a class="table-primary-link" href="./client-profile.html?id=${encodeURIComponent(row.clientId)}&tab=payments">${escapeHtml(getClientName(row.client))}</a><small>${escapeHtml(row.client.email || row.client.mobile || row.clientId)}</small></td>
      <td><strong>${escapeHtml(formatCurrency(todayAmount(row)))}</strong><small>${recordDateKey(row.payment) || recordDateKey(row.dashboard) || "No date"}</small></td>
      <td>${escapeHtml(formatCurrency(row.payment.totalPaid))}</td>
      <td>${escapeHtml(formatCurrency(row.payment.totalPending))}</td>
      <td><span class="status-badge ${escapeHtml(status.toLowerCase().replace(/[^a-z]+/g, "-"))}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(formatDate(updatedAt))}</td>
      <td><button class="table-action" type="button" data-edit-payment="${escapeHtml(row.clientId)}">Update</button></td>
    </tr>`;
  }).join("");
  body.querySelectorAll("[data-edit-payment]").forEach((button) => {
    button.addEventListener("click", () => openDialog(button.dataset.editPayment));
  });
}

function renderAll() {
  renderMetrics();
  renderTable();
  if (activeView && !viewBanner.hidden) {
    const matchingCount = mergedRows().filter(rowMatchesActiveView).length;
    const baseText = activeView === "today"
      ? "Only clients with a commission amount above ₹0 for today are shown."
      : "Only clients with an outstanding amount above ₹0 are shown.";
    viewDescription.textContent = `${matchingCount.toLocaleString("en-IN")} client${matchingCount === 1 ? "" : "s"} found. ${baseText} Use Update to edit any client.`;
  }
}

function openDialog(clientId) {
  const client = clients.get(clientId);
  if (!client) return;
  const payment = payments.get(clientId) || {};
  const dash = dashboard.get(clientId) || {};
  form.reset();
  form.elements.clientId.value = clientId;
  const source = Object.keys(payment).length ? payment : dash;
  form.elements.todayCommission.value = recordDateKey(source) === indiaDateKey() ? amount(source.todayCommission) : 0;
  form.elements.totalPaid.value = amount(payment.totalPaid);
  form.elements.totalPending.value = amount(payment.totalPending);
  form.elements.paymentStatus.value = payment.paymentStatus || dash.paymentStatus || "Not Available";
  form.elements.lastUpdated.value = payment.lastUpdated || dash.lastUpdated || "";
  document.getElementById("paymentDialogTitle").textContent = getClientName(client);
  setInlineMessage(document.getElementById("paymentFormMessage"));
  dialog.showModal();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const clientId = String(data.get("clientId") || "");
  const todayCommission = amount(data.get("todayCommission"));
  const totalPaid = amount(data.get("totalPaid"));
  const totalPending = amount(data.get("totalPending"));
  const paymentStatus = String(data.get("paymentStatus") || "Not Available");
  const lastUpdated = String(data.get("lastUpdated") || "").trim() || currentLabel();
  const message = document.getElementById("paymentFormMessage");
  const saveButton = document.getElementById("savePaymentButton");

  if (!clientId || [todayCommission, totalPaid, totalPending].some((value) => value < 0)) {
    setInlineMessage(message, "Enter valid non-negative payment amounts.", "error");
    return;
  }

  saveButton.disabled = true;
  setInlineMessage(message, "Saving payment data…", "info");
  try {
    const batch = writeBatch(db);
    const dateKey = indiaDateKey();
    batch.set(doc(db, "payments", clientId), {
      todayCommission,
      todayCommissionDate: dateKey,
      todayCommissionUpdatedAt: serverTimestamp(),
      totalPaid,
      totalPending,
      paymentStatus,
      lastUpdated,
      updatedAt: serverTimestamp(),
      updatedBy: currentAdmin.email || ""
    }, { merge: true });
    batch.set(doc(db, "dashboard", clientId), {
      todayCommission,
      todayCommissionDate: dateKey,
      todayCommissionUpdatedAt: serverTimestamp(),
      paymentStatus,
      lastUpdated,
      updatedAt: serverTimestamp(),
      updatedBy: currentAdmin.email || ""
    }, { merge: true });
    const notificationRef = doc(collection(db, "notifications", clientId, "items"));
    batch.set(notificationRef, {
      targetUserId: clientId,
      title: "Payment Details Updated",
      message: "Your latest commission and payment details are available in TWS Connect.",
      type: "payment_update",
      isRead: false,
      createdAt: serverTimestamp()
    });
    const activityRef = doc(collection(db, "users", clientId, "activity_logs"));
    batch.set(activityRef, {
      action: "payment_data_updated",
      description: "Commission and payment values were updated from the Payments module.",
      metadata: { todayCommission, totalPaid, totalPending, paymentStatus, todayCommissionDate: dateKey },
      createdAt: serverTimestamp(),
      createdBy: currentAdmin.email || ""
    });
    await batch.commit();
    form.elements.lastUpdated.value = lastUpdated;
    setInlineMessage(message, "Payment data saved and client notified.", "success");
    setTimeout(() => dialog.close(), 550);
  } catch (error) {
    setInlineMessage(message, error.message || "Payment data could not be saved.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

search.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);
document.getElementById("paymentRefresh").addEventListener("click", renderAll);
initializeViewControls();

unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  clients = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  renderAll();
}, (error) => console.warn("Users listener failed:", error));
unsubscribePayments = onSnapshot(collection(db, "payments"), (snapshot) => {
  payments = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  renderAll();
}, (error) => console.warn("Payments listener failed:", error));
unsubscribeDashboard = onSnapshot(collection(db, "dashboard"), (snapshot) => {
  dashboard = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  renderAll();
}, (error) => console.warn("Dashboard listener failed:", error));

window.addEventListener("beforeunload", () => {
  unsubscribeUsers?.();
  unsubscribePayments?.();
  unsubscribeDashboard?.();
});
