import {
  auth,
  loginWithGoogle,
  logoutAdmin,
  observeAuth,
  verifyAdmin
} from "./admin-auth.js";

const loginButton = document.getElementById("googleLoginButton");
const statusBox = document.getElementById("loginStatus");
const loginPanel = document.getElementById("loginPanel");

function setStatus(message, type = "info") {
  statusBox.textContent = message;
  statusBox.className = `login-status ${type}`;
  statusBox.hidden = !message;
}

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.classList.toggle("loading", isLoading);
  loginButton.querySelector("span").textContent = isLoading
    ? "Verifying admin access..."
    : "Continue with Google";
}

loginButton.addEventListener("click", async () => {
  setLoading(true);
  setStatus("");

  try {
    const credential = await loginWithGoogle();
    const result = await verifyAdmin(credential.user);

    if (!result.allowed) {
      await logoutAdmin();
      return;
    }

    window.location.replace("./dashboard.html");
  } catch (error) {
    console.error("Admin sign-in failed:", error);
    const message = error?.code === "auth/popup-closed-by-user"
      ? "Google sign-in was cancelled. Please try again."
      : error?.code === "auth/unauthorized-domain"
        ? "This website domain is not yet authorized in Firebase Authentication."
        : "Login failed. Please verify your account and try again.";
    setStatus(message, "error");
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

    await auth.signOut();
    setStatus(result.reason, "error");
  } catch (error) {
    console.error("Admin verification failed:", error);
    setStatus("Admin verification failed. Check Firestore permissions and try again.", "error");
  } finally {
    setLoading(false);
    loginPanel.classList.add("ready");
  }
});
