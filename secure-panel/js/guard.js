import { getAccessProfile, signOutSecurePanel, waitForAuthState } from "./firebase.js";
import { endSession, startSession } from "./session.js";
import { showLoading, showToast } from "./components.js";

const LOGIN_ROUTE = "./";
const NOTICE_KEY = "tws-secure-panel-notice";

function redirectToLogin(reason) {
  console.error("[TWS Auth] Redirecting to login.", { reason, destination: LOGIN_ROUTE });
  sessionStorage.setItem(NOTICE_KEY, reason);
  window.location.replace(LOGIN_ROUTE);
}

export async function protectPage(onReady) {
  showLoading();
  const user = await waitForAuthState();
  if (!user) {
    redirectToLogin("Authentication is required to access this page.");
    return;
  }
  try {
    const profile = await getAccessProfile(user);
    if (!profile) {
      await signOutSecurePanel();
      redirectToLogin("Director profile validation failed. Access has been denied.");
      return;
    }
    await startSession(user, profile);
    console.info("[TWS Auth] Dashboard session verified", user);
    console.info("[TWS Auth] Dashboard access granted");
    await onReady({ user, profile });
  } catch (error) {
    console.error("[TWS Auth] Protected route validation failed.", error);
    try { await signOutSecurePanel(); } catch (logoutError) { console.error("[TWS Auth] Logout after validation failure failed.", logoutError); }
    redirectToLogin(error.code || error.message || "Protected route validation failed.");
  }
}

export async function forceLogout(reason = "Your secure session has ended.") {
  console.info("[TWS Auth] Starting logout.", { reason });
  try { await endSession(); } catch (error) { console.error("[TWS Auth] Session cleanup failed.", error); }
  try { await signOutSecurePanel(); } catch (error) { console.error("[TWS Auth] Firebase logout failed.", error); }
  redirectToLogin(reason);
}

export function bindLogout() {
  document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", () => forceLogout()));
}

export function consumeNotice() {
  const message = sessionStorage.getItem(NOTICE_KEY);
  if (message) {
    sessionStorage.removeItem(NOTICE_KEY);
    showToast(message, "info");
  }
}
