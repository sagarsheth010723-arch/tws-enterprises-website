# Build notes — v1.3.0

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
