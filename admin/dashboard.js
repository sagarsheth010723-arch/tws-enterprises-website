import { collection, getCountFromServer } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
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
const lastUpdated = document.getElementById("lastUpdated");

function initials(name, email) {
  const source = String(name || email || "TWS Admin").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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
    const snapshot = await getCountFromServer(collection(db, "users"));
    clientCount.textContent = snapshot.data().count.toLocaleString("en-IN");
  } catch (error) {
    console.warn("Client count could not be loaded:", error);
    clientCount.textContent = "—";
    clientCount.title = "Update Firestore rules to allow administrators to read the users collection.";
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
