# StockFlow for iOS

A native SwiftUI companion to the StockFlow web app. It talks to the same Express API
(`server/`) with the same session cookie, so the web app and phone always show the
same inventory. No server changes are needed.

## Features

- **Scan tab** with a live camera scanner (EAN/UPC, Code 128/39/93, ITF, QR, Data Matrix, PDF417…),
  highlight box, haptics and sound, torch, and typed or pasted codes:
  - **Find** looks up items or locations, then Add, Remove, Move or opens details. Unknown barcodes offer
    “Create item with this barcode”.
  - **Receive / Pick** batch scanning: every scan adds 1, and scanning a location sets where stock goes in or comes out.
    The whole batch is saved with one tap.
  - **Move**: scan the item, then the destination.
  - **Count** (cycle count): scan a location and then its items. The app shows expected vs counted and posts
    the differences as adjustments.
- **Overview**: value, units, low / out of stock, a 30-day movement chart, items needing attention,
  expiring lots, and recent activity.
- **Inventory**: search by name, SKU or barcode; filters and sort; swipe to add, remove or move;
  context-menu previews; item detail with photos (camera or library), stock by location, lots,
  a scannable barcode/QR label, and history.
- **Lots**: receive lots with expiry, supplier and PO. Removals default to the earliest-expiring lot
  (first expired, first out). Lot detail lets you change status.
- **Locations**: grouped by zone with capacity rings, contents, labels, add or count in place.
- **Activity**: the full movement log, grouped by day, with type filters and infinite scroll.
- Workspace switcher, light/dark themes, and Liquid Glass on iOS 26. Home-screen quick actions
  (Scan, Receive, New Item) and `stockflow://` deep links.

Code matching follows the web scanner (`components/scanner/lookup.ts`): it ignores case, and
numeric codes match without leading zeros, so UPC-A, EAN-13 and GTIN-14 forms of a product all match.

## Requirements

- Xcode 26 or later
- iOS 18 or later (iPhone and iPad)

## Running

1. Start the API (for example `pnpm dev`, which serves it on `http://localhost:5001`).
2. Open `ios/StockFlow.xcodeproj` and run the **StockFlow** scheme.
3. On the sign-in screen, enter the server address. A green check means it's reachable.
   - Simulator: `localhost:5001` works as is.
   - Physical iPhone: use your Mac's LAN address (for example `192.168.1.20:5001`), or your
     deployed server's URL.

### Switching servers (dev / prod)

Once a server has been used, the server field is hidden. To switch:

- **Signed in:** Settings → tap the version number at the bottom 5 times → **Developer · Server**.
  Pick a recent server or type a new one. Each server keeps its own sign-in, so flipping
  between dev and production doesn't ask for your password again.
- **Signed out:** press and hold the StockFlow logo on the sign-in screen to show the server field.
- If a server is down, the "Can't Reach Server" screen offers your other servers (in developer mode).

Debug builds default to `http://localhost:5001` (`STOCKFLOW_DEFAULT_SERVER_URL` in the target's
build settings). Release builds start blank.

Barcode scanning needs a real device camera. In the Simulator, use **Enter code**, or a deep link:

```bash
xcrun simctl openurl booted "stockflow://scan?code=ITM-001"
```

Other links: `stockflow://item/<id>`, `stockflow://location/<id>`,
`stockflow://scan?mode=receive`, `stockflow://new-item?barcode=<code>`.

## Tests

Unit tests use Swift Testing and decode real API responses stored in `StockFlowTests/Fixtures`:

```bash
xcodebuild test -project ios/StockFlow.xcodeproj -scheme StockFlow -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

Live end-to-end tests run against a real server when one is configured. Each run registers a throwaway
user and covers stock in/out, transfers, lots, activity, the dashboard and photo upload:

```bash
TEST_RUNNER_STOCKFLOW_TEST_SERVER=http://localhost:5001 xcodebuild test -project ios/StockFlow.xcodeproj -scheme StockFlow -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

## Layout

```
StockFlow/
  App/          app entry, session (AppModel), navigation (Router), quick actions
  Networking/   APIClient (cookie session, error mapping, uploads), typed endpoints
  Models/       Decodable models mirroring prisma/schema.prisma
  Stores/       InventoryStore (workspace catalog cache), CodeMatcher
  Features/     Auth, Overview, Inventory, Stock (adjust/transfer/lots), Scan, Locations, Activity, Settings
  Components/   design system, images, barcode/QR rendering, quantity stepper
```

The Xcode project uses folder-synchronized groups, so new files under `StockFlow/` or
`StockFlowTests/` are picked up automatically.
