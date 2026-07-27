import { changePassword } from "./firebase.js";
import { bindLogout, protectPage } from "./guard.js";
import { renderShell, showToast } from "./components.js";
import { getUserSessions, recordActivity } from "./session.js";
import { applyAppearancePreferences, defaultCompanySettings, getAppearancePreferences, getCompanySettings, saveAppearancePreferences, saveCompanySettings } from "./settings-service.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
const formatDate = (value) => value?.toDate?.() ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value.toDate()) : "Current session";

function passwordError(error) {
  if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") return "Your current password is incorrect.";
  if (error.code === "auth/weak-password") return "Use a stronger password.";
  if (error.code === "auth/requires-recent-login") return "Please sign in again before changing your password.";
  return "Unable to change your password. Please try again.";
}

protectPage(async ({ user }) => {
  const [company, sessions] = await Promise.all([getCompanySettings().catch(() => ({ ...defaultCompanySettings })), getUserSessions(user.uid).catch(() => [])]);
  const preferences = getAppearancePreferences();
  applyAppearancePreferences(preferences);
  const initials = (user.displayName || "Director").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const rows = sessions.length
    ? sessions.map((session) => `<tr><td><b>${session.isActive ? "Active" : "Closed"}</b></td><td>${formatDate(session.startedAt)}</td><td>${formatDate(session.lastActivityAt)}</td></tr>`).join("")
    : "<tr><td colspan=\"3\">No session records are available yet.</td></tr>";
  renderShell({ activePage: "settings", user, content: `
    <section class="page-title"><div><p class="eyebrow">ACCOUNT & SECURITY</p><h1>Secure <span>settings.</span></h1><p>Manage workspace details, interface preferences, and director access controls.</p></div></section>
    <div class="settings-sections">
      <section class="settings-grid">
        <article class="settings-card glass-card"><p class="eyebrow">GENERAL</p><h2>Company details</h2><form class="settings-form" id="companyForm"><label>Company name<input name="companyName" value="${escapeHtml(company.companyName)}" required maxlength="120"></label><label>Company email<input name="companyEmail" type="email" value="${escapeHtml(company.companyEmail)}" required maxlength="160"></label><label>Company phone<input name="companyPhone" type="tel" value="${escapeHtml(company.companyPhone)}" required maxlength="40"></label><label>Company address<input name="companyAddress" value="${escapeHtml(company.companyAddress)}" required maxlength="240"></label><div class="form-actions"><button class="secondary-button" type="submit">Save company details</button></div></form></article>
        <article class="settings-card glass-card"><p class="eyebrow">APPEARANCE</p><h2>Workspace interface</h2><div class="settings-form"><label>Accent colour<select id="accentSelect"><option value="teal">TWS teal</option><option value="violet">Executive violet</option><option value="blue">Signal blue</option></select></label><div class="preference-row"><span><b>Dark mode</b><small>Optimised for secure operations</small></span><label class="switch"><input type="checkbox" checked disabled aria-label="Dark mode enabled"><span></span></label></div><div class="preference-row"><span><b>Compact sidebar</b><small>Reduce navigation width on desktop</small></span><label class="switch"><input id="sidebarCollapse" type="checkbox" aria-label="Toggle compact sidebar"><span></span></label></div></div></article>
      </section>
      <section class="settings-grid">
        <article class="settings-card glass-card"><p class="eyebrow">SECURITY</p><h2>Change password</h2><form class="settings-form" id="passwordForm"><label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required minlength="6"></label><label>New password<input name="newPassword" type="password" autocomplete="new-password" required minlength="8"></label><label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="8"></label><div class="form-actions"><button class="secondary-button" type="submit">Update password</button></div></form><div class="preference-row"><span><b>Logout all sessions</b><small>Requires a secured Firebase Admin endpoint.</small></span><button class="danger-button" id="globalLogout" type="button">Coming soon</button></div></article>
        <article class="settings-card glass-card"><p class="eyebrow">PROFILE</p><h2>Director identity</h2><div class="profile-card"><span class="profile-avatar">${initials}</span><div><b>${escapeHtml(user.displayName || "Director")}</b><p>Profile image support is reserved for a future authenticated media module.</p></div></div><div class="settings-form"><label>Email<input value="${escapeHtml(user.email)}" readonly aria-readonly="true"></label><label>Role<input value="Director" readonly aria-readonly="true"></label></div></article>
      </section>
      <section class="settings-grid">
        <article class="settings-card glass-card"><p class="eyebrow">SYSTEM</p><h2>Runtime information</h2><div class="system-list"><div><span>Version</span><b>v1.2.0</b></div><div><span>Firebase status</span><b>Configured</b></div><div><span>Environment</span><b>Production</b></div><div><span>Last login</span><b>${escapeHtml(user.metadata.lastSignInTime || "Current session")}</b></div></div></article>
        <article class="settings-card glass-card"><p class="eyebrow">SESSION INFORMATION</p><h2>Current browser session</h2><p>Session activity is refreshed while this browser is open. Ending all sessions needs a trusted server-side revocation endpoint, which is not exposed to the browser.</p><button id="refreshSession" class="secondary-button" type="button">Refresh session activity</button></article>
      </section>
      <section class="session-card glass-card"><div class="card-heading"><div><p class="eyebrow">SESSION HISTORY</p><h2>Recent browser sessions</h2></div></div><div class="table-wrap"><table><thead><tr><th>Status</th><th>Started</th><th>Last activity</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    </div>` });
  bindLogout();
  document.querySelector("#accentSelect").value = preferences.accent;
  document.querySelector("#sidebarCollapse").checked = preferences.sidebarCollapsed;
  document.querySelector("#accentSelect").addEventListener("change", (event) => {
    const next = { ...getAppearancePreferences(), accent: event.target.value };
    saveAppearancePreferences(next); applyAppearancePreferences(next); showToast("Accent colour updated.");
  });
  document.querySelector("#sidebarCollapse").addEventListener("change", (event) => {
    const next = { ...getAppearancePreferences(), sidebarCollapsed: event.target.checked };
    saveAppearancePreferences(next); applyAppearancePreferences(next); showToast("Sidebar preference saved.");
  });
  document.querySelector("#companyForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    if (!event.currentTarget.reportValidity()) return;
    button.disabled = true;
    try { await saveCompanySettings(Object.fromEntries(new FormData(event.currentTarget)), user); showToast("Company settings saved."); }
    catch { showToast("Unable to save company settings. Check Firestore rules.", "error"); }
    finally { button.disabled = false; }
  });
  document.querySelector("#passwordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.newPassword !== values.confirmPassword) { showToast("New passwords do not match.", "error"); return; }
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try { await changePassword(values.currentPassword, values.newPassword); event.currentTarget.reset(); showToast("Password updated successfully."); }
    catch (error) { showToast(passwordError(error), "error"); }
    finally { button.disabled = false; }
  });
  document.querySelector("#refreshSession").addEventListener("click", async () => {
    try { await recordActivity(); showToast("Session activity refreshed."); }
    catch { showToast("Unable to refresh the current session.", "error"); }
  });
  document.querySelector("#globalLogout").addEventListener("click", () => showToast("Global sign-out is deliberately unavailable until a trusted Firebase Admin endpoint is configured.", "info"));
});
