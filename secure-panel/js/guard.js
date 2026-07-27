import { observeAccessProfile, observeAuth, signOutSecurePanel } from "./firebase.js";
import { endSession, startSession } from "./session.js";
import { showLoading, showToast } from "./components.js";

const LOGIN_ROUTE = "./";

export function protectPage(onReady) {
  showLoading();
  let unsubscribeProfile = () => {};
  observeAuth(async (user) => {
    if (!user) { window.location.replace(LOGIN_ROUTE); return; }
    try {
      const { getAccessProfile } = await import("./firebase.js");
      const profile = await getAccessProfile(user);
      if (!profile) throw new Error("Access denied");
      await startSession(user, profile);
      unsubscribeProfile();
      unsubscribeProfile = observeAccessProfile(user.uid, async (snapshot) => {
        const data = snapshot.data();
        if (!snapshot.exists() || data.isActive !== true || data.role !== "director" || data.email !== user.email) {
          await forceLogout("Your director access has changed. You have been signed out.");
        }
      }, async () => forceLogout("We could not verify your access. You have been signed out."));
      onReady({ user, profile });
    } catch {
      await forceLogout("Director access could not be verified. You have been signed out.");
    }
  });
}

export async function forceLogout(message) {
  try { await endSession(); } catch {}
  await signOutSecurePanel();
  sessionStorage.setItem("tws-secure-panel-notice", message);
  window.location.replace(LOGIN_ROUTE);
}

export function bindLogout() {
  document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", () => forceLogout("Your secure session has ended.")));
}

export function consumeNotice() {
  const message = sessionStorage.getItem("tws-secure-panel-notice");
  if (message) { sessionStorage.removeItem("tws-secure-panel-notice"); showToast(message, "info"); }
}
