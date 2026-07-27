# TWS Secure Panel v1.3.0

secure-panel is a self-contained, director-only workspace. It has no imports from, links to, or changes within the public website or the existing admin TWS Connect system.

## Module layout

- index.html — Firebase email/password sign-in entry point
- dashboard.html — protected director overview with Telegram status
- settings.html — protected company, appearance, security, profile, system, and session settings
- telegram.html — protected Telegram configuration and operations workspace
- css — isolated base, component, authentication, and page styling
- js — authentication, route guard, components, settings, session, dashboard, and Telegram page modules
- firestore.rules — deployable Firestore security rules for the module collections
- modules/telegram — callable API wrapper and Firebase Functions backend

## Required Firebase configuration

1. Enable Email/Password in Firebase Authentication.
2. Create the Firebase Authentication account director@twsenterprises.in.
3. Add twsenterprises.in to Firebase Authentication's authorised domains.
4. In Firestore, create a document at securePanelUsers/DIRECTOR_AUTH_UID. Use the UID of the director authentication account as DIRECTOR_AUTH_UID. Its required fields are: email = director@twsenterprises.in, role = director, and isActive = true.
5. Deploy firestore.rules using the Firebase CLI or Firebase Console Rules editor.
6. For Telegram, follow BUILD_NOTES.md to deploy the callable function and encryption secret.

The browser cannot create or elevate director profiles. Role documents are intentionally read-only to the browser application. The panel accepts access only when Firebase Authentication, the approved email, and the Firestore document all agree. A role change or deactivation is observed live and immediately signs out the active user.

## Data and session behavior

Company settings are stored at securePanelSettings/company and restricted by the supplied Firestore rules to the verified director. Interface preferences are local to the director browser. Firebase uses local browser persistence for authentication. The panel records minimal session activity in securePanelSessions and marks the current session closed on logout.

Telegram credentials and channel records are never available to the browser through Firestore. The secure callable function is the only component that can access the encrypted token and communicate with Telegram.
