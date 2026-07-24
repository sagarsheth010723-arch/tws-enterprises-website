# V54 — Date-wise Commission & Dashboard Privacy

## Implemented

- Admin Dashboard Today’s Commission now includes only client records dated for the current India date.
- The card automatically becomes ₹0 after the India date changes when no new commission is saved.
- Existing Total Commission Received and Pending Payment Amount remain cumulative and are not reset.
- Client App Data editor saves `todayCommissionDate` and `todayCommissionUpdatedAt`.
- When an old commission belongs to a previous date, the admin editor shows Today’s Commission as 0 to prevent accidentally re-saving yesterday’s amount as today’s.
- Individual eye controls added for Total Investment, Today’s Commission, Total Commission Received, and Pending Payment Amount.
- Hidden values display as `*****`.
- Visibility preferences persist per browser using localStorage.

## Firestore fields added (merge-safe)

- `dashboard/{uid}.todayCommissionDate`
- `dashboard/{uid}.todayCommissionUpdatedAt`
- `payments/{uid}.todayCommissionDate`
- `payments/{uid}.todayCommissionUpdatedAt`
