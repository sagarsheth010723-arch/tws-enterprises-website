import { app, auth, getAccessProfile, signIn, signOutSecurePanel, waitForAuthState } from "./firebase.js";
import { consumeNotice } from "./guard.js";
import { firebaseConfig } from "./firebase-config.js";

const form = document.querySelector("#loginForm");
const email = document.querySelector("#email");
const password = document.querySelector("#password");
const submitButton = document.querySelector("#submitButton");
const message = document.querySelector("#formMessage");

document.querySelectorAll("[data-current-year]").forEach((node) => { node.textContent = new Date().getFullYear(); });
console.info("[TWS Auth] Secure Panel login page loaded", {
  hostname: window.location.hostname,
  url: window.location.href,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  currentFirebaseUser: auth.currentUser
});
consumeNotice();

async function redirectAuthenticatedUser() {
  const user = await waitForAuthState();
  if (!user) {
    console.info("[TWS Auth] No existing Firebase session on login page.");
    return;
  }
  try {
    const profile = await getAccessProfile(user);
    if (!profile) {
      console.error("[TWS Auth] Existing session rejected because director profile validation failed.");
      await signOutSecurePanel();
      message.textContent = "secure-panel/profile-validation-failed";
      return;
    }
    console.info("[TWS Auth] Current Firebase user", user);
    console.info("[TWS Auth] Redirecting to dashboard", { destination: "dashboard.html" });
    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("[TWS Auth] Existing login session validation failed.", error);
    message.textContent = error.code || error.message;
  }
}

document.querySelector(".password-toggle").addEventListener("click", (event) => {
  const visible = password.type === "text";
  password.type = visible ? "password" : "text";
  event.currentTarget.setAttribute("aria-pressed", String(!visible));
  event.currentTarget.setAttribute("aria-label", visible ? "Show password" : "Hide password");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  console.group("[TWS Auth] Login button clicked");
  console.info("Current hostname:", window.location.hostname);
  console.info("Current URL:", window.location.href);
  console.info("Firebase projectId:", firebaseConfig.projectId);
  console.info("Firebase authDomain:", firebaseConfig.authDomain);
  console.info("Current Firebase user:", auth.currentUser);
  console.info("Firebase app/auth verification:", { appName: app.name, authAppName: auth.app.name, sameFirebaseApp: auth.app === app });
  console.groupEnd();
  message.textContent = "";
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Verifying access…";
  try {
    const user = await signIn(email.value, password.value);
    const profile = await getAccessProfile(user);
    if (!profile) {
      await signOutSecurePanel();
      const profileError = new Error("Director profile validation failed.");
      profileError.code = "secure-panel/profile-validation-failed";
      throw profileError;
    }
    console.info("[TWS Auth] Current authenticated user", user);
    console.info("[TWS Auth] Director profile validated");
    console.info("[TWS Auth] Redirecting to dashboard", { destination: "dashboard.html" });
    message.classList.add("success");
    message.textContent = "Access verified. Opening workspace…";
    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("Firebase Error Code:", error.code);
    console.error("Firebase Error Message:", error.message);
    console.error(error);
    message.classList.remove("success");
    message.textContent = error.code || error.message;
    password.select();
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Sign in securely";
  }
});

redirectAuthenticatedUser().catch((error) => {
  console.error("[TWS Auth] Login bootstrap failed.", error);
  message.textContent = error.code || error.message;
});
