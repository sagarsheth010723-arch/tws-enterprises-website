# TWS Connect Admin Panel — V46 Clients Module

## Active features
- Secure Email/Password admin login
- Firestore `admins/{uid}` authorization
- Live client list from `users`
- Search, status filter, source filter, pagination
- Client detail view and account status update
- Manual client entry
- Excel / CSV template download
- Excel / CSV upload with preview
- Required-field validation
- Duplicate email/mobile detection
- Bulk Firestore import in safe chunks
- Error-report Excel download
- Source badges: app registration, Excel import, manual entry

## Important
Excel/manual records create Firestore documents only. They do not create Firebase Authentication accounts.

Imported records contain:
- `source: "excel_import"`
- `authStatus: "not_created"`
- `importBatchId`
- `importedBy`
- `importedAt`

App-registered users continue to appear from the same `users` collection.

## Excel columns
First Name, Last Name, Email, Mobile, DOB, Address, City, Pincode,
Annual Income, Risk Tolerance, Broker, Trading Preferences, Login ID,
Investment Amount, Account Status, Internal Notes.
