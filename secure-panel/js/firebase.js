import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { EmailAuthProvider, browserLocalPersistence, getAuth, onAuthStateChanged, reauthenticateWithCredential, setPersistence, signInWithEmailAndPassword, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { doc, getDoc, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { AUTHORIZED_EMAIL, firebaseConfig } from "./firebase-config.js";

const APP_NAME = "tws-secure-panel";
console.info("[TWS Auth Debug] firebase-config.js loaded.", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});
console.info("[TWS Auth Debug] Firebase apps before initialization:", getApps().map((item) => item.name));
export const app = getApps().some((item) => item.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(firebaseConfig, APP_NAME);
console.info("[TWS Auth Debug] Firebase app resolved.", {
  appName: app.name,
  projectId: app.options.projectId,
  initializedOnce: getApps().filter((item) => item.name === APP_NAME).length === 1
});
export const auth = getAuth(app);
console.info("[TWS Auth Debug] getAuth(app) completed.", {
  authAppName: auth.app.name,
  sameFirebaseApp: auth.app === app
});
export const db = getFirestore(app);
export const normaliseEmail = (email) => String(email || "").trim().toLowerCase();
export const isApprovedEmail = (user) => normaliseEmail(user?.email) === AUTHORIZED_EMAIL;

export async function getAccessProfile(user) {
  console.info("[TWS Auth Debug] getAccessProfile() starting.", { uid: user?.uid || null, email: user?.email || null, approvedEmail: isApprovedEmail(user) });
  if (!user?.uid || !isApprovedEmail(user)) return null;
  const snapshot = await getDoc(doc(db, "securePanelUsers", user.uid));
  console.info("[TWS Auth Debug] Firestore director profile document loaded.", { exists: snapshot.exists() });
  if (!snapshot.exists()) return null;
  const profile = snapshot.data();
  const allowed = profile.isActive === true
    && profile.role === "director"
    && normaliseEmail(profile.email) === AUTHORIZED_EMAIL;
  console.info("[TWS Auth Debug] Director profile validation completed.", { allowed, role: profile.role, isActive: profile.isActive });
  return allowed ? { ...profile, uid: user.uid } : null;
}

export async function signIn(email, password) {
  console.info("[TWS Auth Debug] signIn() invoked.", { email: normaliseEmail(email) });
  if (normaliseEmail(email) !== AUTHORIZED_EMAIL) {
    const error = new Error("This email is not authorised for the Secure Panel.");
    error.code = "secure-panel/not-authorised";
    throw error;
  }
  await setPersistence(auth, browserLocalPersistence);
  console.info("[TWS Auth Debug] Browser local persistence enabled.");
  const credential = await signInWithEmailAndPassword(auth, normaliseEmail(email), password);
  console.info("[TWS Auth Debug] signInWithEmailAndPassword succeeded.", { uid: credential.user.uid, email: credential.user.email });
  const profile = await getAccessProfile(credential.user);
  if (!profile) {
    await signOut(auth);
    const error = new Error("Your director access record is missing, inactive, or invalid.");
    error.code = "secure-panel/access-denied";
    throw error;
  }
  return { user: credential.user, profile };
}

export function observeAuth(callback) {
  console.info("[TWS Auth Debug] Registering onAuthStateChanged observer.", { authAppName: auth.app.name });
  return onAuthStateChanged(auth, (user) => {
    console.info("[TWS Auth Debug] onAuthStateChanged fired. Current Firebase user:", user);
    callback(user);
  });
}

export function observeAccessProfile(uid, callback, onError) {
  return onSnapshot(doc(db, "securePanelUsers", uid), callback, onError);
}

export const signOutSecurePanel = () => signOut(auth);

export async function changePassword(currentPassword, nextPassword) {
  if (!auth.currentUser?.email) throw new Error("No authenticated user is available.");
  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await updatePassword(auth.currentUser, nextPassword);
}
