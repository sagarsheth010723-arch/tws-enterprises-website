# TWS Secure Panel v1.2.0

secure-panel is a self-contained, director-only workspace. It has no imports from, links to, or changes within the public website or the existing admin TWS Connect system.

## Module layout

- index.html — Firebase email/password sign-in entry point
- dashboard.html — protected, dynamic director overview
- settings.html — protected company, appearance, security, profile, system, and session settings
- css — isolated base, component, authentication, and page styling
- js/firebase-config.js — local Firebase project settings and approved email
- js/firebase.js — Firebase application, authentication, password update, and Firestore role service
- js/guard.js — protected-route and automatic access-revocation handling
- js/session.js — Firestore-backed browser-session activity tracking
- js/settings-service.js — company settings persistence and interface preferences
- js/components.js — reusable loading, toast, header, and sidebar components
- firestore.rules — deployable Firestore security rules for this module's collections
- modules/telegram — dormant module foundation; it makes no Telegram API calls

## Required Firebase configuration

1. Enable Email/Password in Firebase Authentication.
2. Create the Firebase Authentication account director@twsenterprises.in.
3. Add twsenterprises.in to Firebase Authentication's authorised domains.
4. In Firestore, create a document at securePanelUsers/DIRECTOR_AUTH_UID. Use the UID of the director authentication account as DIRECTOR_AUTH_UID. Its required fields are: email = director@twsenterprises.in, role = director, and isActive = true.
5. Deploy firestore.rules using the Firebase CLI or Firebase Console Rules editor.

The browser cannot create or elevate director profiles. Role documents are intentionally read-only to the browser application. The panel accepts access only when Firebase Authentication, the approved email, and the Firestore document all agree. A role change or deactivation is observed live and immediately signs out the active user.

## Settings and sessions

Company settings are stored at securePanelSettings/company and restricted by the supplied Firestore rules to the verified director. Interface preferences are local to the director's browser. Firebase uses local browser persistence for authentication. The panel records minimal session activity in securePanelSessions and marks the current session closed on logout.

Global logout is intentionally not available from browser code. Implement it only through a trusted Firebase Admin endpoint that revokes refresh tokens.
