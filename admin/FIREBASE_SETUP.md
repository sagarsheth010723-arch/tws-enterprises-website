# TWS Connect Admin Panel — Firebase setup

## Authentication method
The admin panel uses Firebase Email/Password authentication.
Only these approved accounts are accepted:
- enterprisestws@gmail.com
- director@twsenterprises.in

Both users must exist in Firebase Authentication with Email/Password credentials.

## Firestore administrator records
- enterprisestws@gmail.com — uFmxKuujaUhnsKHVLzIFVBC3PaS2
- director@twsenterprises.in — o8koeHBCfVan0hBJtjj4guHTZfa2

Both `admins/{uid}` documents must contain:
- role: superAdmin
- isActive: true
- email: exact matching email
