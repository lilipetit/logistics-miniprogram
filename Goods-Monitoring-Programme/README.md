# Goods Monitoring Programme

A WeChat Mini Program for lightweight logistics/order tracking with three roles:
**User**, **Courier**, and **Admin**.

This project uses a dark UI theme (black/orange/gold), supports package creation and payment flow, courier status updates, and admin-side order/member management.

## Features

- Authentication: login/register with role selection (`user`, `courier`, `admin`)
- User flow:
  - Create shipment (sender/receiver info, quantity, unit price)
  - Generate order and proceed to payment
  - WeChat/Alipay QR-code payment page
  - Track personal packages and query order status
- Courier flow:
  - Courier center with personal delivery list
  - Package entry page (supports scanner-style input and manual input)
  - Update shipment status (`received`, `transit`, `delivered`)
  - Delivered orders stay visible in courier list for 3 days, then auto-hidden from courier view
- Admin flow:
  - Admin center with order/member management
  - Search/edit users and orders
  - Data statistics page
  - CSV export for reporting
- UX and adaptability:
  - Responsive styles for mobile screens
  - Custom navigation bar and safe-area handling
  - Skyline renderer compatibility adjustments

## Tech Stack

- **Platform**: WeChat Mini Program
- **Renderer**: `skyline` (`glass-easel`)
- **Language**: JavaScript + WXML + WXSS
- **Storage**: Local storage via `wx.getStorageSync` / `wx.setStorageSync`
- **Architecture**: Frontend-only mini program (no external backend service in this repo)

## Project Structure

```text
.
├─ app.js
├─ app.json
├─ app.wxss
├─ components/
│  └─ navigation-bar/
├─ pages/
│  ├─ login/
│  ├─ register/
│  ├─ send-package/
│  ├─ fill-info/
│  ├─ order-list/
│  ├─ payment/
│  ├─ payment-qrcode/
│  ├─ payment-success/
│  ├─ courier-center/
│  ├─ courier-package-entry/
│  ├─ update-status/
│  ├─ admin-center/
│  ├─ admin-stats/
│  ├─ order-manage/
│  └─ my/
├─ utils/
│  ├─ util.js
│  ├─ user-sync.js
│  ├─ stats-storage.js
│  ├─ order-display.js
│  ├─ order-visibility.js
│  ├─ courier-tracking.js
│  ├─ em5-scanner.js
│  └─ clipboard.js
└─ images/
```

## Main Pages

- `pages/login` / `pages/register`: account access and role registration
- `pages/send-package`: user home and package list
- `pages/fill-info`: shipment form + history autofill
- `pages/payment` + `pages/payment-qrcode` + `pages/payment-success`: payment workflow
- `pages/courier-center`: courier dashboard and assigned deliveries
- `pages/courier-package-entry`: scanner/manual package code entry
- `pages/update-status`: delivery status timeline update
- `pages/admin-center` / `pages/admin-stats` / `pages/order-manage`: admin operations and analytics
- `pages/my`: user profile and tracking query modal

## Local Data Model (Storage Keys)

Core keys used in local storage:

- `users`: registered users
- `userInfo`: current logged-in user session
- `orders`: all orders
- `selectedOrderIds`, `batchPaymentAmount`: batch payment temporary data
- `paymentContext`: payment page context data
- history keys for sender/receiver autofill on shipment form

> Note: This project currently stores data locally in WeChat storage. Data is not shared across devices/accounts unless you add a backend service.

## Run Locally

1. Open **WeChat Developer Tools**
2. Import this folder as a Mini Program project
3. Ensure the project `appid` is set correctly in project config
4. Compile and run

No npm installation is required for the current version.

## Scanner Integration Notes

The courier package entry page supports scanner-like input (HID keyboard mode) and manual paste/input.

- Raw scanned codes are normalized to tracking numbers with `XS` prefix
- Helper modules:
  - `utils/courier-tracking.js`
  - `utils/em5-scanner.js`

If you want full vendor SDK integration (plugin/BLE/native bridge), extend `utils/em5-scanner.js` according to the scanner provider documentation.

## Screenshots

You can place UI screenshots under `docs/screenshots/` and reference them here.

Suggested screenshot set:

- Login / Register
- User Home (Send Package)
- Fill Shipment Form
- Payment Method Selection
- Payment QR Code (WeChat / Alipay)
- Courier Center
- Update Delivery Status
- Admin Center
- Admin Statistics

Example markdown (replace with actual files):

```md
![Login](docs/screenshots/login.png)
![Courier Center](docs/screenshots/courier-center.png)
![Admin Center](docs/screenshots/admin-center.png)
```

## Roadmap / TODO

- Add cloud backend (orders/users) for cross-device synchronization
- Add role-based API auth and token/session security
- Add server-side order lifecycle validation
- Add image/file upload for proof of delivery
- Add pagination and advanced filtering in admin modules
- Add automated tests (unit + integration) for core flows
- Add CI checks (lint, formatting, basic build validation)

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit changes with clear messages
4. Push branch and open a Pull Request
5. Include screenshots or short test notes for UI/flow changes

Please keep coding style consistent with current WXML/WXSS/JS structure and avoid introducing breaking changes without clear migration notes.

## Current Limitations

- Frontend/local-storage based demo architecture
- No server-side authentication/token system
- No cloud database synchronization out of the box

## License

For internal or educational use unless you define a separate license policy.