import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where
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
const clientCount = document.getElementById("clientCount");
const pendingClientCount = document.getElementById("pendingClientCount");
const lastUpdated = document.getElementById("lastUpdated");
const recentClientList = document.getElementById("recentClientList");

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

function showDashboard(user, profile) {
  const displayName = profile?.name || user.displayName || "TWS Admin";
  adminName.textContent = displayName;
  adminEmail.textContent = user.email || profile?.email || "";
  adminAvatar.textContent = initials(displayName, user.email);
  gate.hidden = true;
  shell.hidden = false;
}

async function loadDashboardMetrics() {
  lastUpdated.textContent = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date());

  try {
    const usersRef = collection(db, "users");
    const totalSnapshot = await getCountFromServer(usersRef);
    clientCount.textContent = totalSnapshot.data().count.toLocaleString("en-IN");

    const pendingSnapshot = await getCountFromServer(query(usersRef, where("accountStatus", "==", "pending")));
    pendingClientCount.textContent = pendingSnapshot.data().count.toLocaleString("en-IN");
  } catch (error) {
    console.warn("Dashboard counts could not be loaded:", error);
    clientCount.textContent = "—";
    pendingClientCount.textContent = "—";
  }

  try {
    const usersRef = collection(db, "users");
    let snapshot;
    try {
      snapshot = await getDocs(query(usersRef, orderBy("createdAt", "desc"), limit(5)));
    } catch {
      snapshot = await getDocs(query(usersRef, limit(5)));
    }

    if (snapshot.empty) {
      recentClientList.innerHTML = '<div class="timeline-empty">No client registrations found.</div>';
      return;
    }

    recentClientList.innerHTML = snapshot.docs.map((item) => {
      const data = item.data();
      const firstName = String(data.firstName || "").trim();
      const lastName = String(data.lastName || "").trim();
      const name = String(data.fullName || data.name || `${firstName} ${lastName}`).trim() || "Unnamed client";
      const status = String(data.accountStatus || data.status || "pending").toLowerCase();
      const createdAt = data.createdAt || data.registeredAt || data.importedAt;
      return `<a class="recent-client-row" href="./client-profile.html?id=${encodeURIComponent(item.id)}">
        <span class="client-avatar">${escapeHtml(initials(name, data.email))}</span>
        <div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(data.mobile || data.email || item.id)}</small></div>
        <span class="status-badge ${escapeHtml(status)}">${escapeHtml(status)}</span>
        <time>${escapeHtml(formatDate(createdAt))}</time>
      </a>`;
    }).join("");
  } catch (error) {
    console.warn("Recent clients could not be loaded:", error);
    recentClientList.innerHTML = '<div class="timeline-empty">Recent registrations could not be loaded.</div>';
  }
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
    await loadDashboardMetrics();
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
