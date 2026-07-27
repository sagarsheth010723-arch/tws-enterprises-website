# Changelog

## v1.3.1 Debug Build — 27 July 2026

- Switched Secure Panel authentication to the supplied tws-enterprise-control-center Firebase production project configuration.
- Added the least-privilege Firestore rule set required for director profile verification, sessions, and non-sensitive settings.
- Added browser-console diagnostics for Firebase configuration loading, app initialization, Auth binding, observer state, login context, and director-profile verification.
- Added explicit Firebase error code and error object logging for failed sign-in attempts.
- Temporarily displays the raw Firebase error code below the login button for troubleshooting.

## v1.3.0 — 27 July 2026

- Added a fully functional director-only Telegram workspace at telegram.html.
- Added secure bot verification and AES-256-GCM encrypted token storage through Firebase callable functions.
- Added channel add, verification, deletion, channel directory, and live test-message delivery flows.
- Added Telegram delivery preferences and a live Telegram status widget on the enterprise dashboard.
- Added Firebase Functions deployment configuration and BUILD_NOTES.md.

## v1.2.0 — 27 July 2026

- Refined the dashboard with responsive spacing, modern glass cards, polished typography, hover states, transitions, shimmer skeletons, and improved loading feedback.
- Expanded Settings into General, Appearance, Security, Profile, System, and Session Information sections.
- Added Firestore-ready company settings persistence, local interface preferences, and secure Firebase password updates.
- Added an isolated Telegram module foundation with routing, configuration, service boundaries, and disabled Coming Soon navigation.
- Kept Telegram inactive: no credentials, Bot API calls, webhooks, or message functionality were introduced.

## v1.1.0 — 27 July 2026

- Added Firestore-backed director-role verification through securePanelUsers.
- Added protected route guard with live access-profile monitoring and automatic logout.
- Added Firestore-backed secure session activity records and a session-management settings page.
- Refactored shared header, sidebar, loading, and toast UI into reusable JavaScript components.
- Replaced static dashboard values with authenticated identity, role, and session data.
- Added deployable Firestore security rules and Firebase setup documentation.

## v1.0.0

- Introduced the isolated secure-panel module with Firebase email/password sign-in and a protected dashboard.
