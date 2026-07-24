# TWS Connect Admin — V51

## Dashboard totals

The company dashboard now calculates live from Firestore:

- Total Clients: all documents in `users`
- Active Clients: client status is `active`
- Pending Clients: client status is `pending`
- Total Investment: sum of every client's investment, without excluding inactive, suspended, rejected or exited records
- Today's Commission: sum of `dashboard/{clientId}.todayCommission`
- Total Commission Received: sum of `payments/{clientId}.totalPaid`
- Pending Payment Amount: sum of `payments/{clientId}.totalPending`

## Client App Data tab

A single form updates the exact client-facing values:

- Investment amount
- Today's profit / loss
- Today's commission
- Total profit
- Total commission paid
- Pending payment amount
- Payment status
- Last updated
- Remarks

Saving writes to:

- `users/{clientId}`
- `dashboard/{clientId}`
- `payments/{clientId}`
- `notifications/{clientId}/items/{notificationId}`

The Flutter app already streams the dashboard and notification collections, so saved values update without a separate admin analytics module.

## Client creation/import

Manual and Excel client creation now initializes:

- Client record
- Automatic service record
- Dashboard record
- Payment record

Excel import uses a 100-client batch size because each client creates four Firestore writes. This remains below Firestore's 500-write batch limit.

## Service workflow

The manual Assign Service entry point was removed. Services continue to be assigned automatically from registration or Excel import. Existing service records can still be edited.
