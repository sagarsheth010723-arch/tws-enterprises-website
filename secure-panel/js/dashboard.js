import { bindLogout, protectPage } from "./guard.js";
import { renderShell } from "./components.js";
import { getUserSessions } from "./session.js";

function dateTime(value) {
  return value?.toDate?.() ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value.toDate()) : "Current session";
}

protectPage(async ({ user, profile }) => {
  const sessions = await getUserSessions(user.uid).catch(() => []);
  const activeSessions = sessions.filter((session) => session.isActive).length;
  const recentSession = sessions[0];
  const name = (user.displayName || "Director").split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  renderShell({ activePage: "dashboard", user, content: `
    <section class="page-title"><div><p class="eyebrow">TWS ENTERPRISES · SECURE WORKSPACE</p><h1>Good ${greeting}, <span>${name}</span>.</h1><p>Live identity and session information for your protected workspace.</p></div><div class="session-badge"><span class="status-dot"></span><span>Director access active</span></div></section>
    <section class="metric-grid" aria-label="Workspace summary">
      <article class="metric-card glass-card"><div class="metric-icon teal">✓</div><div><span>Authentication</span><strong>Verified</strong><small><i class="positive-dot"></i>Email/password session</small></div></article>
      <article class="metric-card glass-card"><div class="metric-icon violet">◆</div><div><span>Access profile</span><strong>${profile.role}</strong><small>Firestore-verified role</small></div></article>
      <article class="metric-card glass-card"><div class="metric-icon amber">◷</div><div><span>Active sessions</span><strong>${activeSessions}</strong><small>Tracked securely</small></div></article>
    </section>
    <section class="dashboard-grid"><article class="overview-card glass-card"><div class="card-heading"><div><p class="eyebrow">WORKSPACE STATUS</p><h2>Secure panel operational.</h2></div><span class="live-pill"><i></i>LIVE</span></div><p class="overview-copy">Firebase Authentication, Firestore role verification, protected routes and session monitoring are all active for this director-only workspace.</p><div class="progress-wrap"><div><span>Latest session activity</span><b>${dateTime(recentSession?.lastActivityAt)}</b></div><div class="progress-track"><i></i></div><small>Activity is updated while this secure panel is in use.</small></div></article>
    <article class="identity-card glass-card"><p class="eyebrow">ACTIVE IDENTITY</p><div class="identity-row"><span class="identity-avatar">${(user.displayName || "Director").slice(0, 1).toUpperCase()}</span><div><h2>${user.displayName || "Director"}</h2><p>${user.email}</p></div></div><div class="identity-meta"><span><small>ACCESS LEVEL</small><b>Director only</b></span><span><small>LAST SIGN-IN</small><b>${dateTime(recentSession?.startedAt)}</b></span></div></article></section>
    <section class="security-card glass-card"><div class="security-icon">✓</div><div><p class="eyebrow">SECURITY STATUS</p><h2>Live role monitoring is enabled.</h2><p>If the corresponding Firestore access record becomes inactive or loses the director role, the panel automatically ends the session.</p></div><button class="logout-secondary" data-logout type="button">End session <span>→</span></button></section>` });
  bindLogout();
});
