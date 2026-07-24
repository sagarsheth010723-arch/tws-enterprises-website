import {
  collection,
  collectionGroup,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./admin-auth.js";
import {
  amount,
  downloadCsv,
  escapeHtml,
  formatCurrency,
  formatDate,
  getClientName,
  mountAdminPage,
  setInlineMessage
} from "./admin-layout.js";

await mountAdminPage({ activePage: "reports", title: "Reports" });

let users = new Map();
let dashboard = new Map();
let payments = new Map();
let services = [];
let documents = [];
const unsubscribers = [];
const message = document.getElementById("reportMessage");

function clientIdFor(item) {
  return item.clientId || item.ref?.parent?.parent?.id || "";
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function statusOf(data = {}) {
  return String(data.accountStatus || data.profileStatus || data.status || "pending").trim().toLowerCase();
}

function renderMetrics() {
  const totalInvestment = [...users.entries()].reduce((sum, [id, data]) => {
    const dash = dashboard.get(id) || {};
    const value = data.investmentAmount !== undefined && data.investmentAmount !== null && String(data.investmentAmount).trim() !== ""
      ? data.investmentAmount
      : dash.investmentAmount;
    return sum + amount(value);
  }, 0);
  const totalReceived = [...payments.values()].reduce((sum, data) => sum + amount(data.totalPaid), 0);
  const totalPending = [...payments.values()].reduce((sum, data) => sum + amount(data.totalPending), 0);
  document.getElementById("reportClients").textContent = users.size.toLocaleString("en-IN");
  document.getElementById("reportInvestment").textContent = formatCurrency(totalInvestment);
  document.getElementById("reportReceived").textContent = formatCurrency(totalReceived);
  document.getElementById("reportPending").textContent = formatCurrency(totalPending);
}

function renderBreakdowns() {
  const serviceCounts = new Map();
  services.forEach((item) => {
    const key = item.serviceName || "Unspecified";
    serviceCounts.set(key, (serviceCounts.get(key) || 0) + 1);
  });
  const serviceContainer = document.getElementById("serviceBreakdown");
  serviceContainer.innerHTML = serviceCounts.size
    ? [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `<div class="summary-row"><span>${escapeHtml(name)}</span><strong>${count.toLocaleString("en-IN")}</strong></div>`).join("")
    : '<div class="timeline-empty">No service assignments found.</div>';

  const paymentCounts = new Map();
  [...users.keys()].forEach((id) => {
    const data = payments.get(id) || {};
    const key = data.paymentStatus || "Not Available";
    paymentCounts.set(key, (paymentCounts.get(key) || 0) + 1);
  });
  const paymentContainer = document.getElementById("paymentBreakdown");
  paymentContainer.innerHTML = paymentCounts.size
    ? [...paymentCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `<div class="summary-row"><span>${escapeHtml(name)}</span><strong>${count.toLocaleString("en-IN")}</strong></div>`).join("")
    : '<div class="timeline-empty">No payment records found.</div>';
}

function renderAll() {
  renderMetrics();
  renderBreakdowns();
}

function exportClients() {
  const rows = [...users.entries()].map(([id, data]) => ({
    Client_ID: id,
    First_Name: data.firstName || "",
    Last_Name: data.lastName || "",
    Full_Name: getClientName(data),
    Mobile: data.mobile || "",
    Email: data.personalEmail || data.email || "",
    City: data.city || "",
    Pincode: data.pincode || "",
    Broker: data.broker || data.tradingBroker || "",
    Risk_Tolerance: data.riskTolerance || "",
    Selected_Service: data.serviceName || data.selectedService || data.serviceInterest || "",
    Investment_Amount: amount(data.investmentAmount || dashboard.get(id)?.investmentAmount),
    Account_Status: statusOf(data),
    Registration_Date: data.registrationDate || formatDate(data.createdAt, false)
  }));
  finishExport(downloadCsv(`TWS_Clients_${dateStamp()}.csv`, rows), "Clients report exported.");
}

function exportPayments() {
  const rows = [...users.entries()].map(([id, client]) => {
    const data = payments.get(id) || {};
    return {
      Client_ID: id,
      Client_Name: getClientName(client),
      Mobile: client.mobile || "",
      Email: client.personalEmail || client.email || "",
      Today_Commission: amount(data.todayCommission),
      Today_Commission_Date: data.todayCommissionDate || "",
      Total_Commission_Received: amount(data.totalPaid),
      Pending_Payment_Amount: amount(data.totalPending),
      Payment_Status: data.paymentStatus || "Not Available",
      Last_Updated: data.lastUpdated || formatDate(data.updatedAt)
    };
  });
  finishExport(downloadCsv(`TWS_Payments_${dateStamp()}.csv`, rows), "Payments report exported.");
}

function exportServices() {
  const rows = services.map((item) => {
    const clientId = clientIdFor(item);
    const client = users.get(clientId) || {};
    return {
      Client_ID: clientId,
      Client_Name: getClientName(client),
      Service_Name: item.serviceName || "",
      Service_Status: item.serviceStatus || "pending",
      Start_Date: item.startDate || "",
      Expiry_Date: item.expiryDate || "",
      Investment_Amount: amount(item.investmentAmount),
      Service_Fee: amount(item.serviceFee),
      Assigned_Advisor: item.assignedAdvisor || "",
      Renewal_Status: item.renewalStatus || "",
      Internal_Remarks: item.internalRemarks || ""
    };
  });
  finishExport(downloadCsv(`TWS_Services_${dateStamp()}.csv`, rows), "Services report exported.");
}

function exportDocuments() {
  const rows = documents.map((item) => {
    const clientId = clientIdFor(item);
    const client = users.get(clientId) || {};
    return {
      Client_ID: clientId,
      Client_Name: getClientName(client),
      Document_Title: item.documentTitle || "",
      Document_Type: item.documentType || "",
      Document_Status: item.documentStatus || "requested",
      Client_Visible: item.clientVisible === true ? "Yes" : "No",
      Issue_Date: item.issueDate || "",
      Expiry_Date: item.documentExpiryDate || "",
      Document_URL: item.documentUrl || "",
      Admin_Notes: item.documentNotes || "",
      Updated_At: formatDate(item.updatedAt || item.createdAt)
    };
  });
  finishExport(downloadCsv(`TWS_Documents_${dateStamp()}.csv`, rows), "Documents report exported.");
}

function finishExport(success, text) {
  setInlineMessage(message, success ? text : "No records are available for this report.", success ? "success" : "error");
}

document.getElementById("exportClients").addEventListener("click", exportClients);
document.getElementById("exportPayments").addEventListener("click", exportPayments);
document.getElementById("exportServices").addEventListener("click", exportServices);
document.getElementById("exportDocuments").addEventListener("click", exportDocuments);

unsubscribers.push(onSnapshot(collection(db, "users"), (snapshot) => {
  users = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  renderAll();
}));
unsubscribers.push(onSnapshot(collection(db, "dashboard"), (snapshot) => {
  dashboard = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  renderAll();
}));
unsubscribers.push(onSnapshot(collection(db, "payments"), (snapshot) => {
  payments = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  renderAll();
}));
unsubscribers.push(onSnapshot(collectionGroup(db, "services"), (snapshot) => {
  services = snapshot.docs.map((item) => ({ id: item.id, ref: item.ref, clientId: item.ref.parent.parent?.id || "", ...item.data() }));
  renderAll();
}));
unsubscribers.push(onSnapshot(collectionGroup(db, "documents"), (snapshot) => {
  documents = snapshot.docs.map((item) => ({ id: item.id, ref: item.ref, clientId: item.ref.parent.parent?.id || "", ...item.data() }));
  renderAll();
}));

window.addEventListener("beforeunload", () => unsubscribers.forEach((unsubscribe) => unsubscribe?.()));
