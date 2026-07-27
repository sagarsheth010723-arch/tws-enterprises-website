import { getAccessProfile, observeAuth, signIn, signOutSecurePanel } from "./firebase.js";
import { consumeNotice } from "./guard.js";

const form = document.querySelector("#loginForm");
const email = document.querySelector("#email");
const password = document.querySelector("#password");
const submitButton = document.querySelector("#submitButton");
const message = document.querySelector("#formMessage");

document.querySelectorAll("[data-current-year]").forEach((node) => { node.textContent = new Date().getFullYear(); });
consumeNotice();
observeAuth(async (user) => {
  if (!user) return;
  try {
    if (await getAccessProfile(user)) window.location.replace("dashboard.html");
    else await signOutSecurePanel();
  } catch { await signOutSecurePanel(); }
});

document.querySelector(".password-toggle").addEventListener("click", (event) => {
  const visible = password.type === "text";
  password.type = visible ? "password" : "text";
  event.currentTarget.setAttribute("aria-pressed", String(!visible));
  event.currentTarget.setAttribute("aria-label", visible ? "Show password" : "Hide password");
});

function displayError(error) {
  const copy = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network unavailable. Check your connection and try again.",
    "secure-panel/not-authorised": "This email is not authorised for the Secure Panel."
  };
  message.textContent = copy[error.code] || "We could not sign you in. Please try again.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  message.textContent = "";
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Verifying access…";
  try {
    await signIn(email.value, password.value);
    message.classList.add("success");
    message.textContent = "Access verified. Opening workspace…";
    window.location.replace("dashboard.html");
  } catch (error) {
    displayError(error);
    password.select();
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Sign in securely";
  }
});
