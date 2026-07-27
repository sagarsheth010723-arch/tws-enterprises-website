import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { EmailAuthProvider, browserLocalPersistence, getAuth, onAuthStateChanged, reauthenticateWithCredential, setPersistence, signInWithEmailAndPassword, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { AUTHORIZED_EMAIL, firebaseConfig } from "./firebase-config.js";

const APP_NAME = "tws-secure-panel";
export const DIRECTOR_PROFILE_ID = "CfcTen6kMHObMMQjcWHiwizt6Fz2";

console.info("[TWS Auth] firebase-config.js loaded", { projectId: firebaseConfig.projectId, authDomain: firebaseConfig.authDomain });
const existingApp = getApps().find((item) => item.name === APP_NAME);
export const app = existingApp || initializeApp(firebaseConfig, APP_NAME);
console.info("[TWS Auth] Firebase initialized", {
  appName: app.name,
  initializedOnce: getApps().filter((item) => item.name === APP_NAME).length === 1
});

export const auth = getAuth(app);
export const db = getFirestore(app);
console.info("[TWS Auth] getAuth(app) verified", { authAppName: auth.app.name, sameFirebaseApp: auth.app === app });

export const normaliseEmail = (email) => String(email || "").trim().toLowerCase();
export const isApprovedEmail = (user) => normaliseEmail(user?.email) === AUTHORIZED_EMAIL;

export function waitForAuthState() {
  console.info("[TWS Auth] Waiting for Firebase authentication state");
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      console.info("[TWS Auth] Current authenticated user", user);
      resolve(user);
    });
  });
}

export async function getAccessProfile(user) {
  if (!user?.uid) {
    console.error("[TWS Auth] Firestore profile validation failed: no authenticated Firebase user.");
    return null;
  }
  if (!isApprovedEmail(user)) {
    console.error("[TWS Auth] Firestore profile validation failed: email is not authorised.", { email: user.email });
    return null;
  }
  console.info("[TWS Auth] Loading Firestore profile", { document: `securePanelUsers/${DIRECTOR_PROFILE_ID}` });
  const snapshot = await getDoc(doc(db, "securePanelUsers", DIRECTOR_PROFILE_ID));
  if (!snapshot.exists()) {
    console.error("[TWS Auth] Firestore profile missing.", { document: DIRECTOR_PROFILE_ID });
    return null;
  }
  const profile = snapshot.data();
  console.info("[TWS Auth] Firestore profile loaded", profile);
  const allowed = normaliseEmail(profile.email) === AUTHORIZED_EMAIL
    && profile.role === "director"
    && profile.isActive === true;
  if (!allowed) {
    console.error("[TWS Auth] Director profile validation failed.", {
      emailMatches: normaliseEmail(profile.email) === AUTHORIZED_EMAIL,
      role: profile.role,
      isActive: profile.isActive
    });
    return null;
  }
  console.info("[TWS Auth] Director profile validated");
  return { ...profile, id: DIRECTOR_PROFILE_ID };
}

export async function signIn(email, password) {
  const normalisedEmail = normaliseEmail(email);
  console.info("[TWS Auth] Starting Firebase login", { email: normalisedEmail });
  if (normalisedEmail !== AUTHORIZED_EMAIL) {
    const error = new Error("Only the director email is authorised for this panel.");
    error.code = "secure-panel/email-not-authorised";
    throw error;
  }
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(auth, normalisedEmail, password);
  console.info("[TWS Auth] Firebase login successful", credential.user);
  return credential.user;
}

export async function signOutSecurePanel() {
  await signOut(auth);
  console.info("[TWS Auth] Logout completed");
}

export async function changePassword(currentPassword, nextPassword) {
  if (!auth.currentUser?.email) throw new Error("No authenticated user is available.");
  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await updatePassword(auth.currentUser, nextPassword);
}
