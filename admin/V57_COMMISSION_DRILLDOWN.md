# V57 — Commission Drill-down

## Dashboard
- Clicking **Today's Commission** opens the Payments module filtered to clients with a commission above ₹0 for the current India date.
- Clicking **Pending Payment Amount** opens the Payments module filtered to clients with a pending amount above ₹0.
- Eye visibility controls continue to work independently.

## Payments module
- `?view=today` shows only today's commission clients.
- `?view=pending` shows only clients with pending commission.
- Matching clients remain editable through the existing **Update** button.
- Filter cards and **Show all clients** allow switching views without creating any new Firestore collections.
