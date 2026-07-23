import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig, approvedAdminEmails } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const normalizedApprovedEmails = new Set(
  approvedAdminEmails.map((email) => email.trim().toLowerCase())
);

export async function loginWithGoogle() {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithPopup(auth, provider);
}

export async function logoutAdmin() {
  await signOut(auth);
  window.location.replace("./");
}

export async function verifyAdmin(user) {
  if (!user?.uid || !user.email) {
    return { allowed: false, reason: "Authentication required." };
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  if (!normalizedApprovedEmails.has(normalizedEmail)) {
    return { allowed: false, reason: "This Google account is not approved for admin access." };
  }

  const adminRef = doc(db, "admins", user.uid);
  const adminSnapshot = await getDoc(adminRef);

  if (!adminSnapshot.exists()) {
    return { allowed: false, reason: "Admin permission record was not found." };
  }

  const data = adminSnapshot.data();
  const storedEmail = String(data.email || "").trim().toLowerCase();
  const allowed =
    data.isActive === true &&
    data.role === "superAdmin" &&
    storedEmail === normalizedEmail;

  return {
    allowed,
    reason: allowed ? "" : "This admin account is inactive or incorrectly configured.",
    profile: allowed ? data : null
  };
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
