import {
  auth,
  loginWithEmail,
  logoutAdmin,
  observeAuth,
  verifyAdmin
} from "./admin-auth.js";

const loginForm = document.getElementById("adminLoginForm");
const emailInput = document.getElementById("adminEmailInput");
const passwordInput = document.getElementById("adminPasswordInput");
const loginButton = document.getElementById("emailLoginButton");
const togglePassword = document.getElementById("togglePassword");
const statusBox = document.getElementById("loginStatus");
const loginPanel = document.getElementById("loginPanel");

function setStatus(message, type = "info") {
  statusBox.textContent = message;
  statusBox.className = `login-status ${type}`;
  statusBox.hidden = !message;
}

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  emailInput.disabled = isLoading;
  passwordInput.disabled = isLoading;
  loginButton.querySelector("span").textContent = isLoading
    ? "Verifying access..."
    : "Sign in securely";
}

function friendlyError(error) {
  switch (error?.code) {
    case "admin/email-not-approved":
      return "This email is not approved for TWS admin access.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a few minutes and try again.";
    case "auth/user-disabled":
      return "This Firebase account has been disabled.";
    default:
      return `Login failed${error?.code ? ` (${error.code})` : ""}. Please try again.`;
  }
}

togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.textContent = show ? "Hide" : "Show";
  togglePassword.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(true);
  setStatus("");

  try {
    const credential = await loginWithEmail(emailInput.value, passwordInput.value);
    const result = await verifyAdmin(credential.user);

    if (!result.allowed) {
      await auth.signOut();
      setStatus(result.reason, "error");
      return;
    }

    window.location.replace("./dashboard.html");
  } catch (error) {
    console.error("Admin email sign-in failed:", error);
    setStatus(friendlyError(error), "error");
  } finally {
    setLoading(false);
  }
});

observeAuth(async (user) => {
  if (!user) {
    loginPanel.classList.add("ready");
    return;
  }

  setLoading(true);
  setStatus("Checking your admin permissions...", "info");

  try {
    const result = await verifyAdmin(user);
    if (result.allowed) {
      window.location.replace("./dashboard.html");
      return;
    }

    await logoutAdmin();
  } catch (error) {
    console.error("Admin verification failed:", error);
    await auth.signOut();
    setStatus("Admin verification failed. Please sign in again.", "error");
  } finally {
    setLoading(false);
    loginPanel.classList.add("ready");
  }
});
