export function showLoading(message = "Verifying secure access") {
  document.querySelector("#app").innerHTML = `<div class="access-loader"><div class="loader-ring"></div><p>${message}</p><div class="skeleton-grid"><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i></div></div>`;
}

export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  window.setTimeout(() => { toast.classList.remove("visible"); window.setTimeout(() => toast.remove(), 220); }, 4200);
}

export function renderShell({ activePage, user, content }) {
  const firstName = (user.displayName || "Director").trim().split(/\s+/)[0] || "Director";
  const initials = (user.displayName || "Director").split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  const pageName = activePage === "dashboard" ? "Overview" : "Settings";
  document.querySelector("#app").innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-head"><a class="brand" href="dashboard.html"><span class="brand-mark">T</span><span>TWS <em>ENTERPRISES</em></span></a><button class="sidebar-close" data-close-sidebar aria-label="Close navigation">×</button></div>
        <nav aria-label="Secure panel navigation"><p class="nav-label">WORKSPACE</p>
          <a class="nav-link ${activePage === "dashboard" ? "active" : ""}" href="dashboard.html"><span class="nav-icon">OVR</span>Overview</a>
          <a class="nav-link ${activePage === "settings" ? "active" : ""}" href="settings.html"><span class="nav-icon">SET</span>Settings</a>
          <span class="nav-link nav-link-disabled" aria-disabled="true"><span class="nav-icon">TG</span>Telegram <small>COMING SOON</small></span>
        </nav>
        <div class="sidebar-status"><span class="status-dot"></span><p><b>Protected workspace</b><small>Director access verified</small></p></div>
      </aside>
      <div class="workspace">
        <header class="top-header"><button class="menu-button" id="menuButton" aria-label="Open navigation"><i></i><i></i><i></i></button><div class="breadcrumb"><span>Secure Panel</span><b>/</b><strong>${pageName}</strong></div><div class="header-actions"><div class="profile"><span class="avatar">${initials}</span><span><b>${firstName}</b><small>Director</small></span></div><button class="logout-button" data-logout type="button">Log out <span>↗</span></button></div></header>
        <main class="content">${content}</main>
      </div>
    </div>`;
  document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sidebar").classList.add("open"));
  document.querySelector("[data-close-sidebar]").addEventListener("click", () => document.querySelector("#sidebar").classList.remove("open"));
}
