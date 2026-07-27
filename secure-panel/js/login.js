import { app, auth, getAccessProfile, observeAuth, signIn, signOutSecurePanel } from "./firebase.js";
import { consumeNotice } from "./guard.js";
import { firebaseConfig } from "./firebase-config.js";

const form = document.querySelector("#loginForm");
const email = document.querySelector("#email");
const password = document.querySelector("#password");
const submitButton = document.querySelector("#submitButton");
const message = document.querySelector("#formMessage");

document.querySelectorAll("[data-current-year]").forEach((node) => { node.textContent = new Date().getFullYear(); });
console.info("[TWS Auth Debug] Secure Panel login page loaded.", {
  hostname: window.location.hostname,
  url: window.location.href,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  currentFirebaseUser: auth.currentUser
});
consumeNotice();
observeAuth(async (user) => {
  if (!user) return;
  try {
    if (await getAccessProfile(user)) {
      console.info("[TWS Auth Debug] Current Firebase user before redirecting:", user);
      window.location.replace("dashboard.html");
    }
    else await signOutSecurePanel();
  } catch { await signOutSecurePanel(); }
});

document.querySelector(".password-toggle").addEventListener("click", (event) => {
  const visible = password.type === "text";
  password.type = visible ? "password" : "text";
  event.currentTarget.setAttribute("aria-pressed", String(!visible));
  event.currentTarget.setAttribute("aria-label", visible ? "Show password" : "Hide password");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  console.group("[TWS Auth Debug] Login attempt");
  console.info("Firebase projectId:", firebaseConfig.projectId);
  console.info("Firebase authDomain:", firebaseConfig.authDomain);
  console.info("Current hostname:", window.location.hostname);
  console.info("Current URL:", window.location.href);
  console.info("Current Firebase user before login:", auth.currentUser);
  console.info("firebase-config.js verification:", Boolean(firebaseConfig?.projectId && firebaseConfig?.authDomain));
  console.info("Firebase app/auth verification:", { appName: app.name, authAppName: auth.app.name, sameFirebaseApp: auth.app === app });
  console.groupEnd();
  message.textContent = "";
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Verifying access…";
  try {
    await signIn(email.value, password.value);
    console.info("[TWS Auth Debug] Current Firebase user before redirecting:", auth.currentUser);
    message.classList.add("success");
    message.textContent = "Access verified. Opening workspace…";
    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("Firebase Error Code:", error.code);
    console.error("Firebase Error Message:", error.message);
    console.error(error);
    message.textContent = error.code || error.message;
    password.select();
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Sign in securely";
  }
});
