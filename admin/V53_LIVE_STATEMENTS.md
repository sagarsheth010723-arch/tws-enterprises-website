# TWS Enterprises Admin V53 — Live Statements

The existing client Documents tab remains unchanged as the editor.

When a document is saved with **Client Visible** enabled:

- The document is written to `users/{clientId}/documents/{documentId}`.
- A user notification is created in `notifications/{clientId}/items/{notificationId}`.
- The TWS Connect V53 Statements tab displays the document in real time.

Admin-only documents remain hidden from the client app and do not create a client notification.
