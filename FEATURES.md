# V-POS Project Features

This document summarizes what the current project can do based on the implemented code in `src/`.

## Core Platform
- Android-first Ionic + Angular POS app with Capacitor integration.
- Local-first data layer using SQLite (`@capacitor-community/sqlite`) with DB copied from bundled assets.
- Route protection with login guard (`/sign-in` required before `/menu/*`).
- Side-menu + tabbed navigation for operations screens.
- Live update support using Capawesome LiveUpdate (checks online and can reload to newer bundle).

## Authentication and Access
- Sign-in screen with animated UI (Rive) and stored session (`login-data` in Ionic Storage).
- Local offline credential validation through SQLite user table.
- Connection settings screen to store server IP/port and test `/api/ping`.
- Logout flow from drawer menu.

## POS Transactions
- POS sales flow with customer selection.
- Up to two assigned personnel per transaction.
- Pickup/Delivery category selection.
- Item add/remove with quantity editing and stock limit checks.
- Refill vs non-refill unit pricing.
- Discount input and computed subtotal/VAT/total.
- Checkout supports full and partial payment.
- Payment methods include Cash, GCash, and Bank Transfer.
- Optional due-date support for partial payments.
- Sale persistence to SQLite (`salestbl`) plus item lines (`salescarttbl`).
- Automatic inventory deduction and item history logging on sale completion.
- Personnel transaction/salary linkage during checkout.
- Receipt preview and optional print after confirmation.

## Sales Management
- Sales list with infinite scroll pagination.
- Date range filtering.
- Search by reference number or customer name.
- Running total of sales amount.
- Sales details modal supports receipt reprint.
- Sales details modal supports adding notes.
- Sales details modal supports balance payment for unpaid sales.
- Sales details modal supports credit history viewing.
- Sales details modal supports payment metadata edits.
- Sales details modal supports full order cancellation with required note.
- Sales details modal supports per-item cancellation with quantity validation.
- Lend items from completed sales (with validation and lend receipt printing).

## Inventory and Product Data
- Inventory screen with category-based browsing.
- Search by item code or description.
- Sort by code, description, fill qty, empty qty.
- Infinite loading and pull-to-refresh.
- Item CRUD via modal forms.
- Item history viewing per product.
- Category management module.
- Commission rate management module.
- Warehouse item management module.
- Disposed/junk item tracking module.
- Stock updates and reverse updates for sale cancellation/lending/cancelled lending.

## Transfers and Restocking
- Transfer list with date filtering, pagination, and field-specific search.
- Transfer creation types include Store convert/create/used.
- Transfer creation types include Store restock out/in.
- Transfer creation types include Warehouse out/in.
- Transfer creation types include Warehouse restock out/in.
- Supplier management module for transfer targets.
- Convert/restock detail modals and cancellation flow with status updates.
- Auto-generated reference numbers for transfer documents.

## Customers and Credit
- Customer master list with pagination/search/add/edit/delete.
- Search by customer name or address.
- Customer transaction history by date.
- Customers with balance report.
- Lended items view and lend history.
- Inactive customer detection/listing.
- Customer balance updates tied to partial payments and sales events.

## Personnel and Payroll Support
- Personnel CRUD and searchable list.
- Role-based rate settings (Driver/Rider handling present).
- Personnel transactions viewer.
- Salary history viewer and salary payment logging.
- Salary update/reversal hooks tied to sales and cancellation flows.

## Petty Cash
- Add petty cash log entry.
- Date filtering for petty cash logs.
- Search by remarks.
- Pagination/infinite scroll.
- Computed totals for selected period.

## User Accounts
- User account list with add/edit/delete.
- Search by employee name or username.
- Offline login lookup from local DB.

## Dashboard and Analytics
- Dashboard summary cards for sales, profit, and expenses.
- Date-filtered analytics queries.
- Highcharts top-items-sold visualization.
- Highcharts personnel transactions/salary visualization.
- Highcharts low-stock chart (Store/Warehouse switch).
- Lists for expense details and lend activity.
- Quick transfer actions from low-stock items.
- Built-in AI chat modal that answers from local SQLite data (inventory/customers/sales keyword-driven).

## Printing
- iMin printer integration via local WebView bridge/service.
- POS receipt printing.
- Receipt reprint.
- Balance payment slip printing.
- Salary payment slip printing.
- Lend slip printing.
- Business details test/preview print.
- Receipt formatting with optional logo and customizable business info.

## Settings and Customization
- Business name and address settings.
- Receipt label field settings.
- Logo upload and storage.
- Receipt/card layout configuration modal.

## Notifications    
- Notifications page and notification service exist.
- Current UI seeds sample notifications in code and supports mark-as-read behavior.

## Logging and Utilities
- App log service for writing/reading/clearing local logs.
- Startup APP_INITIALIZER logs DB init event.
- Build/version helper scripts in project root (`sync-version.js`, `build-debug.bat`, etc.).

## Notes
- Some capabilities are local/offline-first by design and rely on bundled SQLite data.
- Several services contain online API methods, but major app flows currently execute local DB methods.
- Notifications currently use sample seeded entries in the component (not full remote push flow).
