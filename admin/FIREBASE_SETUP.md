# TWS Connect Admin Panel — Firebase setup

## 1. Authorized domains
Firebase Console → Authentication → Settings → Authorized domains.
Confirm these domains are present:
- localhost
- twsenterprises.in
- www.twsenterprises.in

## 2. Firestore rules
The admin panel reads `admins/{uid}` and, beginning with the dashboard, reads the `users` collection.
Merge the rules in `firestore-rules-snippet.txt` into the project's existing rules. Do not delete unrelated rules used by the Flutter app.

## 3. Approved administrators
- enterprisestws@gmail.com — uFmxKuujaUhnsKHVLzIFVBC3PaS2
- director@twsenterprises.in — o8koeHBCfVan0hBJtjj4guHTZfa2

Both Firestore documents must use:
- role: superAdmin
- isActive: true
- email: exact matching email
