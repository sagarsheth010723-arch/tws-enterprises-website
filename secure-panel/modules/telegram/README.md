# Telegram module

The Telegram module provides director-only bot configuration, encrypted token storage, channel management, verification, and test delivery.

Browser code never calls Telegram directly and cannot read a bot token. The browser invokes the securePanelTelegram Firebase callable function. The function validates the Firebase director role, encrypts token data before saving it, and is the only layer that communicates with Telegram.

## Structure

- dashboard.js and routing.js provide the module route boundary.
- config contains client-safe configuration.
- services contains the callable-function wrapper and session boundary.
- functions contains the server-side Firebase Functions implementation.
- assets is reserved for module-local visual assets.

Deploy the function and Firestore rules according to BUILD_NOTES.md before configuring a bot.
