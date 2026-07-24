import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db, logoutAdmin, observeAuth, verifyAdmin } from "./admin-auth.js";

const gate = document.getElementById("authGate");
const shell = document.getElementById("adminShell");
const adminName = document.getElementById("adminName");
const adminEmail = document.getElementById("adminEmail");
const adminAvatar = document.getElementById("adminAvatar");
const logoutButton = document.getElementById("logoutButton");
const menuButton = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("adminSidebar");
const lastUpdated = document.getElementById("lastUpdated");
const recentClientList = document.getElementById("recentClientList");

const metricElements = {
  totalClients: document.getElementById("clientCount"),
  activeClients: document.getElementById("activeClientCount"),
  pendingClients: document.getElementById("pendingClientCount"),
  totalInvestment: document.getElementById("totalInvestment"),
  todayCommission: document.getElementById("todayCommission"),
  totalCommissionReceived: document.getElementById("totalCommissionReceived"),
  pendingPaymentAmount: document.getElementById("pendingPaymentAmount")
};

let users = new Map();
let dashboardRecords = new Map();
let paymentRecords = new Map();
let unsubscribeUsers = null;
let unsubscribeDashboard = null;
let unsubscribePayments = null;
let unsubscribeRecentClients = null;

function initials(name, email) {
  const source = String(name || email || "TWS Admin").trim();
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = dateValue(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function amount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function normalizedStatus(userId, userData) {
  const dashboardStatus = dashboardRecords.get(userId)?.accountStatus;
  return String(userData?.accountStatus || userData?.profileStatus || userData?.status || dashboardStatus || "pending")
    .trim()
    .toLowerCase();
}

function updateTimestamp() {
  lastUpdated.textContent = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date());
}

function renderMetrics() {
  const clientEntries = [...users.entries()];
  const totalClients = clientEntries.length;
  const activeClients = clientEntries.filter(([id, data]) => normalizedStatus(id, data) === "active").length;
  const pendingClients = clientEntries.filter(([id, data]) => normalizedStatus(id, data) === "pending").length;

  // Investment is taken from users/{uid} first because every registration/import writes it there.
  // Dashboard value is only a fallback. No status filter is applied, so exited clients remain included.
  const totalInvestment = clientEntries.reduce((sum, [id, data]) => {
    const userInvestment = data?.investmentAmount;
    const dashboardInvestment = dashboardRecords.get(id)?.investmentAmount;
    return sum + amount(userInvestment !== undefined && userInvestment !== null && String(userInvestment).trim() !== ""
      ? userInvestment
      : dashboardInvestment);
  }, 0);

  const todayCommission = [...dashboardRecords.values()]
    .reduce((sum, record) => sum + amount(record?.todayCommission), 0);
  const totalCommissionReceived = [...paymentRecords.values()]
    .reduce((sum, record) => sum + amount(record?.totalPaid), 0);
  const pendingPaymentAmount = [...paymentRecords.values()]
    .reduce((sum, record) => sum + amount(record?.totalPending), 0);

  metricElements.totalClients.textContent = totalClients.toLocaleString("en-IN");
  metricElements.activeClients.textContent = activeClients.toLocaleString("en-IN");
  metricElements.pendingClients.textContent = pendingClients.toLocaleString("en-IN");
  metricElements.totalInvestment.textContent = formatCurrency(totalInvestment);
  metricElements.todayCommission.textContent = formatCurrency(todayCommission);
  metricElements.totalCommissionReceived.textContent = formatCurrency(totalCommissionReceived);
  metricElements.pendingPaymentAmount.textContent = formatCurrency(pendingPaymentAmount);
  updateTimestamp();
}

function showDashboard(user, profile) {
  const displayName = profile?.name || user.displayName || "TWS Admin";
  adminName.textContent = displayName;
  adminEmail.textContent = user.email || profile?.email || "";
  adminAvatar.textContent = initials(displayName, user.email);
  gate.hidden = true;
  shell.hidden = false;
}

function renderRecentClients(snapshot) {
  if (snapshot.empty) {
    recentClientList.innerHTML = '<div class="timeline-empty">No client registrations found.</div>';
    return;
  }

  recentClientList.innerHTML = snapshot.docs.map((item) => {
    const data = item.data();
    const firstName = String(data.firstName || "").trim();
    const lastName = String(data.lastName || "").trim();
    const name = String(data.fullName || data.name || `${firstName} ${lastName}`).trim() || "Unnamed client";
    const status = normalizedStatus(item.id, data);
    const createdAt = data.createdAt || data.registeredAt || data.registrationDate || data.importedAt;
    return `<a class="recent-client-row" href="./client-profile.html?id=${encodeURIComponent(item.id)}">
      <span class="client-avatar">${escapeHtml(initials(name, data.email))}</span>
      <div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(data.mobile || data.email || item.id)}</small></div>
      <span class="status-badge ${escapeHtml(status)}">${escapeHtml(status)}</span>
      <time>${escapeHtml(formatDate(createdAt))}</time>
    </a>`;
  }).join("");
}

function subscribeDashboardData() {
  unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
    users = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
    renderMetrics();
  }, (error) => {
    console.warn("Users dashboard listener failed:", error);
    Object.values(metricElements).forEach((element) => { element.textContent = "—"; });
  });

  unsubscribeDashboard = onSnapshot(collection(db, "dashboard"), (snapshot) => {
    dashboardRecords = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
    renderMetrics();
  }, (error) => console.warn("Client dashboard listener failed:", error));

  unsubscribePayments = onSnapshot(collection(db, "payments"), (snapshot) => {
    paymentRecords = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
    renderMetrics();
  }, (error) => console.warn("Payment listener failed:", error));

  let recentQuery;
  try {
    recentQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5));
  } catch {
    recentQuery = query(collection(db, "users"), limit(5));
  }

  unsubscribeRecentClients = onSnapshot(recentQuery, renderRecentClients, async (error) => {
    console.warn("Recent clients ordered query failed:", error);
    unsubscribeRecentClients?.();
    unsubscribeRecentClients = onSnapshot(
      query(collection(db, "users"), limit(5)),
      renderRecentClients,
      () => { recentClientList.innerHTML = '<div class="timeline-empty">Recent registrations could not be loaded.</div>'; }
    );
  });
}

observeAuth(async (user) => {
  if (!user) {
    window.location.replace("./");
    return;
  }

  try {
    const result = await verifyAdmin(user);
    if (!result.allowed) {
      await logoutAdmin();
      return;
    }

    showDashboard(user, result.profile);
    subscribeDashboardData();
  } catch (error) {
    console.error("Admin authorization failed:", error);
    gate.querySelector("p").textContent = "Unable to verify admin access. Check Firestore rules and reload.";
  }
});

logoutButton.addEventListener("click", logoutAdmin);
menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));

document.querySelectorAll("[data-coming-soon]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("moduleNotice").showModal();
  });
});

window.addEventListener("beforeunload", () => {
  unsubscribeUsers?.();
  unsubscribeDashboard?.();
  unsubscribePayments?.();
  unsubscribeRecentClients?.();
});
