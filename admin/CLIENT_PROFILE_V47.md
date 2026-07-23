# TWS Connect Admin Panel — V47 Client Profile & Approval

## Added
- Dedicated client profile page
- Overview sections for personal, investment and trading data
- Approve, reject, suspend and reactivate actions
- Account status selector with optional approval/rejection reason
- Admin review checklist
- Editable client profile
- Private internal notes stored under `users/{uid}/admin_notes`
- Per-client activity logs stored under `users/{uid}/activity_logs`
- Dashboard pending client count
- Dashboard recent registrations list
- Client list now opens dedicated client profiles

## Firestore writes
Main client record:
- `accountStatus`
- `statusReason`
- `statusUpdatedAt`
- `statusUpdatedBy`
- approval and checklist fields

Subcollections:
- `users/{clientId}/admin_notes/{noteId}`
- `users/{clientId}/activity_logs/{logId}`

## Important
Services, payments and documents tabs are visible placeholders only. Their implementation remains in later phases.
