# StockFlow — Inventory & Warehouse Management

StockFlow tracks stock across locations, lots and warehouses. Staff can scan barcodes from a phone camera or a handheld scanner, and every movement is recorded in an audit history. The frontend is Next.js; the backend is an Express API on MySQL, Redis and MinIO.

## Features

- **Multi-location stock:** define a location structure (zone / aisle / shelf / bin) and generate location codes and barcodes from it.
- **Lots and batches:** optional per-item lot tracking with expiry dates and status (active, quarantined, recalled…).
- **Stock operations:** receive, remove, adjust and transfer through guided wizards. Operations are atomic, so concurrent requests can't oversell.
- **Scanning:** scan item or location barcodes and QR codes with any phone camera, or type/scan with a USB or Bluetooth handheld scanner.
- **Activity log:** every movement with who, when, where, lot and reason. Filterable and exportable to CSV.
- **Low-stock alerts:** each item has a reorder point, and the overview surfaces what needs restocking.
- **Labels:** printable barcode and QR labels (PDF) for items and locations.
- **Reports:** stock in/out over time, value by category, top movers with real period-over-period change.
- **Suppliers and customers:** link items to suppliers and customers.
- **Teams:** multiple workspaces, each with Owner / Admin / Member roles and email invitations.
- **Command palette** (Ctrl/Cmd + K) to jump to any item, location or page.
- **Themes and layouts:** light and dark mode, and a mobile-first layout with a bottom tab bar and a raised scan button.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui + Radix, lucide-react, recharts, sonner |
| Backend | Express 5, TypeScript, Prisma 6, zod validation, Passport (local) + express-session on Redis |
| Data | MySQL 8, Redis 7, MinIO (S3-compatible) for item images |
| Scanning & labels | @zxing/browser, jsbarcode, qrcode, jsPDF |
| Tests | Playwright end-to-end tests against an isolated Docker stack |

## Getting started

Prerequisites: Node.js 20+, pnpm 10 (`corepack enable` or `npm i -g pnpm`), Docker Desktop.

```bash
pnpm install
cp .example.env .dev.env   # then fill in secrets (see below)
pnpm dev
```

`pnpm dev` does the following:
1. Starts MySQL, Redis and MinIO in Docker.
2. Waits for the database.
3. Pushes the Prisma schema.
4. Runs Next.js on http://localhost:3000 and the API on http://localhost:5001.

The Next.js dev server proxies `/api/*` to the API.

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Full dev environment (Docker stack + schema sync + frontend + API) |
| `pnpm dev:front` / `pnpm dev:back` | Only the frontend / only the API |
| `pnpm stack:up` | Only the Docker services |
| `pnpm prisma:sync` | Push `prisma/schema.prisma` to the dev database |
| `pnpm lint` / `pnpm type-check` | ESLint / TypeScript |
| `pnpm build` / `pnpm start` | Production build / serve the frontend |
| `pnpm prod:build` | Build and start the production Docker images |
| `pnpm backup` / `pnpm restore` | MySQL + MinIO backup/restore (see [BACKUPS.md](BACKUPS.md)) |

## Testing

End-to-end tests run against an **isolated** stack (separate MySQL/Redis/MinIO containers and ports), so they never touch your dev data.

1. Create `.test.env`: copy `.dev.env` and change the ports so they don't clash with dev. For example: `APP_INTERNAL_PORT=3100`, `SERVER_INTERNAL_PORT=5100`, `MYSQL_PORT=3309`, `REDIS_PORT=6381`, `MINIO_API_PORT=9004`, `MINIO_CONSOLE_PORT=9005`, `MYSQL_DATABASE=inventory_software_test`.
2. Run:

```bash
pnpm test:setup   # fresh test containers + schema
pnpm test:e2e     # resets the test DB, starts the test servers if needed, runs Playwright
pnpm test:report  # open the HTML report
```

The screenshot sweep seeds a demo workspace and captures every page at desktop and mobile widths, in light and dark mode, into `test-results/screens/`:

```bash
VISUAL=1 npx dotenv -e .test.env --expand -- npx playwright test --project=visual
```

## Project structure

```
app/                  Next.js routes
  dashboard/          the signed-in app (overview, items, locations, activity, reports, …)
  (marketing & auth)  landing, pricing, login, signup, legal pages
components/
  ui/                 shadcn/Radix primitives
  common/             page header, stat card, empty/error/loading states, status badges, confirm dialog
  app-shell/          sidebar, mobile nav, workspace switcher, command palette, scan provider
  stock/ scanner/     stock adjustment/transfer flows and the camera scanner
  items/ locations/ catalog/ partners/ workspace/ reports/ marketing/ auth/   feature components
lib/
  api/                typed API client (one module per resource, shared client.ts)
  workspace-context   current user, workspace and role
  format.ts stock.ts  formatting helpers and status definitions
server/               Express API: routes/, controllers/, services/, utils/ (access control, stock, validation)
prisma/               schema.prisma + migrations
tests/                Playwright e2e tests and the visual sweep
docs/ui-guidelines.md how to build UI in this codebase — read before adding pages
```

## API

All routes live under `/api` and require a session, except `/api/auth/*` and `/api/invitations/*`. Every endpoint checks that the resources it touches belong to the caller's workspace. Responses look like `{ status: "success" | "error", message?, data }`. Validation errors return 400 with `errors[]`, and insufficient stock returns 409. In development, interactive docs are served at http://localhost:5001/api-docs.

Main resources: `auth`, `workspaces`, `workspace-members`, `invitations`, `items`, `items/images`, `lots`, `locations`, `categories`, `suppliers`, `customers`, `transactions`, `dashboard/summary`, `analytics`.

### Roles

| Action | Member | Admin | Owner |
|---|---|---|---|
| View everything, adjust/transfer stock, create/edit items, lots, locations, categories, suppliers, customers | ✓ | ✓ | ✓ |
| Delete records, toggle lot tracking, edit workspace settings & location structure, manage invitations | | ✓ | ✓ |
| Change roles / remove members | | Members & admins | Anyone (never the last owner) |
| Grant Owner, delete the workspace | | | ✓ |

## Deployment notes

- Production runs `prisma migrate deploy`. A database originally created with `db push` must be baselined first (`prisma migrate resolve --applied <migration>`).
- Required in production: `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`. Optional: `CORS_ORIGINS` (comma-separated extra origins).
- Set `COOKIE_SECURE=true` once the app is served over HTTPS. It turns on automatically when `NODE_ENV=production` and the app URL is `https`.
- Rate limits key on the client IP, so make sure the edge proxy (Traefik) sets `X-Forwarded-For`.
- Payments (Stripe) are not wired up yet. The Billing page shows the workspace's plan and trial, and upgrade requests go to the contact email in `components/marketing/site-config.ts`.

## Troubleshooting

- **Port already in use:** `npx kill-port 3000 5001`
- **Database not reachable:** `docker compose -p inventory-app-dev ps` then `docker compose -p inventory-app-dev logs mysql`
- **Schema out of sync in dev:** `pnpm prisma:sync`
- **Camera scanning doesn't start on a phone:** browsers only allow the camera on HTTPS or `localhost`. Use HTTPS (or a tunnel) when testing from another device.
