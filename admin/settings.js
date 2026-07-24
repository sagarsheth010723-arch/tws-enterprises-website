import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./admin-auth.js";
import { mountAdminPage, setInlineMessage } from "./admin-layout.js";

const { user, profile } = await mountAdminPage({ activePage: "settings", title: "Settings" });

const STORAGE_KEY = "twsAdminDashboardFinancialVisibilityV1";
const keys = ["totalInvestment", "todayCommission", "totalCommissionReceived", "pendingPaymentAmount"];
const form = document.getElementById("adminProfileForm");
const nameInput = document.getElementById("settingsAdminName");
const profileMessage = document.getElementById("adminProfileMessage");
const privacyMessage = document.getElementById("privacySettingsMessage");

nameInput.value = profile.name || user.displayName || "TWS Admin";
document.getElementById("settingsAdminEmail").value = user.email || profile.email || "";
document.getElementById("settingsAdminRole").value = profile.role || "superAdmin";
document.getElementById("settingsAdminStatus").value = profile.isActive === true ? "Active" : "Inactive";

function readVisibility() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.fromEntries(keys.map((key) => [key, value?.[key] === true]));
  } catch {
    return Object.fromEntries(keys.map((key) => [key, false]));
  }
}

function syncCheckboxes(values = readVisibility()) {
  document.querySelectorAll("[data-privacy-key]").forEach((input) => {
    input.checked = values[input.dataset.privacyKey] === true;
  });
}

function selectedVisibility() {
  return Object.fromEntries([...document.querySelectorAll("[data-privacy-key]")].map((input) => [input.dataset.privacyKey, input.checked]));
}

syncCheckboxes();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const saveButton = document.getElementById("saveAdminProfile");
  if (!name) {
    setInlineMessage(profileMessage, "Display name is required.", "error");
    return;
  }
  saveButton.disabled = true;
  setInlineMessage(profileMessage, "Saving admin profile…", "info");
  try {
    await setDoc(doc(db, "admins", user.uid), {
      name,
      updatedAt: serverTimestamp(),
      updatedBy: user.email || ""
    }, { merge: true });
    document.getElementById("adminName").textContent = name;
    document.getElementById("adminAvatar").textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    setInlineMessage(profileMessage, "Admin profile updated.", "success");
  } catch (error) {
    setInlineMessage(profileMessage, error.message || "Admin profile could not be updated.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

document.getElementById("savePrivacySettings").addEventListener("click", () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedVisibility()));
    setInlineMessage(privacyMessage, "Dashboard privacy settings saved for this browser.", "success");
  } catch (error) {
    setInlineMessage(privacyMessage, error.message || "Privacy settings could not be saved.", "error");
  }
});

document.getElementById("showAllFinancialCards").addEventListener("click", () => {
  const visible = Object.fromEntries(keys.map((key) => [key, false]));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
  syncCheckboxes(visible);
  setInlineMessage(privacyMessage, "All dashboard amounts will be visible.", "success");
});
