# V56 — Strict Date-wise Commission + Bulk Client Delete

- Dashboard Today's Commission counts only records whose `todayCommissionDate` equals the current India date.
- Records without an explicit date are treated as zero.
- The card displays the active India date and resets automatically at midnight.
- Clients page supports row selection, select current page, select all filtered clients, and bulk delete.
- Bulk delete removes known related Firestore records: user services, notes, activity logs, documents, dashboard, payments, notification items, client metadata, and the user document.
