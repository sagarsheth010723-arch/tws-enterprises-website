import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./firebase.js";

const COMPANY_DOCUMENT = doc(db, "securePanelSettings", "company");
const PREFERENCES_KEY = "tws-secure-panel-preferences";

export const defaultCompanySettings = Object.freeze({
  companyName: "TWS Enterprises Private Limited",
  companyEmail: "hello@twsenterprises.in",
  companyPhone: "+91 88281 67181",
  companyAddress: "C/o. Vishu Harsha Momaya, Maruti Nagar, St. Xaviers School Road, Baroi, Mundra, Kachchh, Gujarat, 370421."
});

export async function getCompanySettings() {
  const snapshot = await getDoc(COMPANY_DOCUMENT);
  return snapshot.exists() ? { ...defaultCompanySettings, ...snapshot.data() } : { ...defaultCompanySettings };
}

export async function saveCompanySettings(values, user) {
  const clean = {
    companyName: values.companyName.trim(),
    companyEmail: values.companyEmail.trim().toLowerCase(),
    companyPhone: values.companyPhone.trim(),
    companyAddress: values.companyAddress.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  };
  await setDoc(COMPANY_DOCUMENT, clean, { merge: true });
  return clean;
}

export function getAppearancePreferences() {
  try {
    return { accent: "teal", sidebarCollapsed: false, ...JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}") };
  } catch { return { accent: "teal", sidebarCollapsed: false }; }
}

export function saveAppearancePreferences(preferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function applyAppearancePreferences(preferences) {
  document.documentElement.dataset.accent = preferences.accent;
  document.documentElement.classList.toggle("sidebar-collapsed", Boolean(preferences.sidebarCollapsed));
}
