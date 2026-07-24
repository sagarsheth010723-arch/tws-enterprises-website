# V55 — All Admin Modules Live

This build activates every left-sidebar section without changing the existing Firebase project or client app collections.

## Modules

- Services: live service assignment list and editing.
- Payments: live commission/payment overview and client notification on save.
- Documents: global document registry, add/edit/delete, client visibility and notification.
- Notifications: send, list, mark read/unread and delete.
- Support: live client contact directory and direct WhatsApp/email actions.
- Reports: live summaries and CSV exports for clients, payments, services and documents.
- Settings: admin display name and browser-level financial privacy controls.
- Activity Logs: read-only global audit trail and CSV export.

## Existing data paths used

- `users/{uid}`
- `dashboard/{uid}`
- `payments/{uid}`
- `users/{uid}/services/{serviceId}`
- `users/{uid}/documents/{documentId}`
- `notifications/{uid}/items/{notificationId}`
- `users/{uid}/activity_logs/{logId}`
- `admins/{uid}`

No duplicate CRM collection was introduced.
