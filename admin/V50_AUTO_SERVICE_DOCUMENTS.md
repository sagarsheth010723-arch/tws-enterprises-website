# TWS Connect Admin — V50

## Fixed: default service assignment
- Only three services are accepted:
  - Portfolio Management Service
  - Wealth Management
  - Compounding Strategy
- Manual client creation automatically creates the service record.
- Excel import automatically creates the service record.
- Existing/app registration clients are auto-assigned when `serviceInterest`,
  `service_interest`, `serviceName`, or `selectedService` exists.
- Service start date always equals the client registration date.
- If an Excel registration date is missing, the import date is used.
- Manual assignment start date defaults to registration date.

## Excel columns added
- Service Name (required)
- Registration Date (optional; import date fallback)

## Website application form
- Service dropdown is restricted to the approved three services.
- Registration date is submitted automatically with the application.

## Next phase completed: Document Registry
- Add/edit/delete document records
- Requested/Received/Verified/Rejected states
- Secure external document URL
- Client visibility flag
- Issue and expiry dates
- Admin notes
- Metrics and activity logs

## Firestore paths
- `users/{clientId}/services/{serviceId}`
- `users/{clientId}/documents/{documentId}`

Binary file upload is intentionally deferred until Firebase Storage is enabled.
