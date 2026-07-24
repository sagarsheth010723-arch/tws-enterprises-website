import { logoutAdmin, observeAuth, verifyAdmin } from "./admin-auth.js";

const NAV_ITEMS = [
  ["dashboard", "./dashboard.html", "⌂", "Dashboard"],
  ["clients", "./clients.html", "◎", "Clients"],
  ["services", "./services.html", "◇", "Services"],
  ["payments", "./payments.html", "₹", "Payments"],
  ["documents", "./documents.html", "▤", "Documents"],
  ["notifications", "./notifications.html", "◉", "Notifications"],
  ["support", "./support.html", "?", "Support"],
  ["reports", "./reports.html", "⌁", "Reports"],
  ["divider"],
  ["settings", "./settings.html", "⚙", "Settings"],
  ["activity", "./activity-logs.html", "↺", "Activity Logs"]
];

function initials(name, email) {
  const source = String(name || email || "TWS Admin").trim();
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function navHtml(activePage) {
  return NAV_ITEMS.map((item) => {
    if (item[0] === "divider") return '<div class="nav-divider"></div>';
    const [key, href, icon, label] = item;
    return `<a class="${key === activePage ? "active" : ""}" href="${href}"><i>${icon}</i><span>${label}</span></a>`;
  }).join("");
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

export function valueDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value, includeTime = true) {
  const date = valueDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

export function amount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount(value));
}

export function getClientName(data = {}) {
  const firstName = String(data.firstName || "").trim();
  const lastName = String(data.lastName || "").trim();
  return String(data.fullName || data.name || `${firstName} ${lastName}`).trim() || "Unnamed client";
}

export function setInlineMessage(element, text = "", type = "info") {
  if (!element) return;
  element.hidden = !text;
  element.className = `modal-status ${type}`;
  element.textContent = text;
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return false;
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(quote).join(","), ...rows.map((row) => headers.map((header) => quote(row[header])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function mountAdminPage({ activePage, title, eyebrow = "TWS CONNECT OPERATIONS" }) {
  const template = document.getElementById("pageContent");
  const content = template?.innerHTML || "";
  const root = document.getElementById("adminPage");

  root.innerHTML = `
    <div class="auth-gate" id="authGate">
      <div class="gate-spinner"></div>
      <h1>Verifying access</h1>
      <p>Please wait while your TWS administrator permissions are checked.</p>
    </div>
    <div class="admin-shell" id="adminShell" hidden>
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="sidebar-brand">
          <img src="../assets/tws-main-logo.png" alt="TWS Enterprises">
          <span>TWS CONNECT<small>ADMIN PANEL</small></span>
        </div>
        <nav class="sidebar-nav" aria-label="Admin navigation">${navHtml(activePage)}</nav>
        <div class="sidebar-footer"><span>Secure Firebase access</span><small>TWS Connect only</small></div>
      </aside>
      <main class="admin-main">
        <header class="admin-topbar">
          <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar">☰</button>
          <div><span class="admin-eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1></div>
          <div class="admin-account">
            <div class="admin-avatar" id="adminAvatar">TS</div>
            <div><strong id="adminName">TWS Admin</strong><small id="adminEmail"></small></div>
            <button id="logoutButton" type="button">Log out</button>
          </div>
        </header>
        <section class="dashboard-content module-page-content">${content}</section>
      </main>
    </div>`;

  document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    document.getElementById("adminSidebar")?.classList.toggle("open");
  });
  document.getElementById("logoutButton")?.addEventListener("click", logoutAdmin);

  return new Promise((resolve, reject) => {
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
        const displayName = result.profile?.name || user.displayName || "TWS Admin";
        document.getElementById("adminName").textContent = displayName;
        document.getElementById("adminEmail").textContent = user.email || result.profile?.email || "";
        document.getElementById("adminAvatar").textContent = initials(displayName, user.email);
        document.getElementById("authGate").hidden = true;
        document.getElementById("adminShell").hidden = false;
        resolve({ user, profile: result.profile || {} });
      } catch (error) {
        console.error("Admin authorization failed:", error);
        const gateText = document.querySelector("#authGate p");
        if (gateText) gateText.textContent = "Unable to verify admin access. Check Firebase and reload.";
        reject(error);
      }
    });
  });
}
