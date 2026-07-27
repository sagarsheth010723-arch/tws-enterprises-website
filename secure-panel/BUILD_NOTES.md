# Build notes — v1.3.2 Authentication Fixed

## Authentication flow

The director account authenticates with Firebase Email/Password and browserLocalPersistence. After Firebase resolves the auth state, the panel reads exactly securePanelUsers/CfcTen6kMHObMMQjcWHiwizt6Fz2. It validates email = director@twsenterprises.in, role = director, and isActive = true before granting access.

The fixed profile document is not the Firebase Auth UID. Do not create any UID-named access document and do not create users or director collections.

## Authentication diagnostics

The build logs Firebase project configuration, current browser URL, app and Auth identity, current Firebase user, Firestore role lookup, and raw sign-in errors in the browser console. The login page temporarily displays the original Firebase error code below the sign-in button.

## Production authentication checklist

The Secure Panel uses the existing tws-enterprise-control-center Firebase project. No new Firebase project or client configuration is required.

1. Confirm Firebase Email/Password is enabled and director@twsenterprises.in is the only authorised account.
2. Confirm the already configured authorised domain list contains www.twsenterprises.in and twsenterprises.in.
3. Confirm the existing Firestore document securePanelUsers/CfcTen6kMHObMMQjcWHiwizt6Fz2 contains email = director@twsenterprises.in, role = director, and isActive = true.
4. Deploy the secure-panel firestore.rules file before using the panel.

The currently deployed deny-all Firestore rules prevent the panel from reading the required director profile document. The supplied replacement remains default-deny: it allows only the authenticated director email to read the one fixed profile document, protects all other profiles, and keeps Telegram token and channel documents inaccessible to browser clients.

## Scope

This release adds a secure Telegram module to secure-panel. The public website and the existing admin system remain unchanged.

## Required deployment steps

1. From secure-panel/modules/telegram/functions, install dependencies with npm install.
2. Authenticate the Firebase CLI against the same Firebase project used by secure-panel.
3. Create the Telegram encryption secret with firebase functions:secrets:set TELEGRAM_TOKEN_ENCRYPTION_KEY. Use a long, random secret value and do not store it in source control.
4. From secure-panel/modules/telegram, deploy with firebase deploy --config firebase.json.

The supplied Firebase config deploys the securePanelTelegram callable function to asia-south1 and updates the Firestore rules in the secure-panel root.

## Operational requirements

- Firebase Functions requires a Firebase project with Cloud Functions billing enabled.
- The Telegram bot must be an administrator of any channel that will be verified or used for test delivery.
- The director account must continue to have a valid securePanelUsers role document.
- Never place a bot token in browser code, Firebase client configuration, or source control.

## Security design

The callable function checks the Firebase authentication token and Firestore director role on every request. Bot tokens are encrypted using AES-256-GCM with a key derived from the Firebase secret. Encrypted token data, channel records, and Telegram settings are denied to direct browser Firestore access.
