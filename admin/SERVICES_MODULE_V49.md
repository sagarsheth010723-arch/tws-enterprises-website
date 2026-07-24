# TWS Connect Admin — V49 Services Assignment

## Locked service catalogue
Only the following services are available:
1. Portfolio Management Service
2. Wealth Management
3. Compounding Strategy

## Completed
- Activated Services tab in each client profile
- Assign service
- Edit service assignment
- Start and expiry dates
- Investment amount
- Service fee
- Assigned advisor
- Status: Pending, Active, Paused, Expired, Cancelled
- Renewal tracking
- Internal remarks
- Pause, reactivate and cancel controls
- Assigned, active and expiring-soon counters
- Client activity-log integration

## Firestore
Service records are stored only at:

`users/{clientId}/services/{serviceId}`

No payment gateway or payment collection has been added.
