# StockFlow UI guidelines

How dashboard pages are built. Follow this for every new page or component.

## Stack
- Next.js 16 App Router, React 19, Tailwind v4 (CSS-only config in `app/globals.css`), shadcn/radix primitives in `components/ui/*`.
- Icons: `lucide-react`. Toasts: `sonner` (`import { toast } from "sonner"`).
- Every dashboard page is a client component rendered inside `app/dashboard/layout.tsx`, which already provides the sidebar, mobile top bar, mobile bottom tab bar, auth guard, workspace context, scanner, command palette (Ctrl/Cmd+K) and confirm dialog. **Pages must not render their own navigation or fixed mobile headers.**

## Colors — tokens only
Never use raw palette classes (`bg-gray-100`, `text-white`, `bg-blue-50`, `text-green-600`, hex values). Use tokens so light and dark mode both work:

| Purpose | Classes |
|---|---|
| Page / surfaces | `bg-background`, `bg-card`, `bg-muted`, `bg-popover` |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground` |
| Brand / primary action | `bg-primary text-primary-foreground`, `text-primary`, soft: `bg-primary/10 text-primary` |
| Hover / selected surface | `bg-accent text-accent-foreground` (subtle — **not** a brand color) |
| Status | `success`, `warning`, `destructive`, `info` — solid: `bg-success text-success-foreground`; soft: `bg-success/12 text-success` (warning soft: `bg-warning/15 text-warning-foreground dark:text-warning`) |
| Borders | `border` (defaults to `border-border`), `border-input` for fields |
| Charts | `var(--chart-1)` … `var(--chart-5)` (these are oklch — use `var(--chart-1)` directly, never `hsl(var(--...))`) |

Exception: printable label previews (white paper) may use `bg-white text-black`.

## Layout
```tsx
import { PageContainer, PageHeader, SectionHeader } from "@/components/common/page"

<PageContainer>
  <PageHeader
    title="Locations"
    description="Where your stock lives"
    back={{ href: "/dashboard/locations", label: "All locations" }}   // detail pages only
    actions={<Button><Plus /> Add location</Button>}
  />
  ...
</PageContainer>
```
- Spacing between sections: `space-y-6` (or `gap-6`). Cards: `components/ui/card` or `rounded-xl border bg-card`.
- Mobile first. Tables become stacked cards/rows below `md` (hide the table with `hidden md:block`, show a list with `md:hidden`). Touch targets ≥ 40px. Nothing may overflow horizontally at 375px width — wrap long codes with `truncate`/`break-all`, wrap tables in `overflow-x-auto`.
- Buttons: `components/ui/button` variants `default | outline | secondary | ghost | destructive | link`, sizes `sm | default | lg | icon`. Put an icon before the label (`<Plus /> Add item`). Primary action is `default`, secondary actions `outline`. Never nest `<Button>` inside `<Link>` — use `<Button asChild><Link href=…>…</Link></Button>`.

## Shared building blocks (`components/common/*`)
| Component | Use for |
|---|---|
| `PageContainer`, `PageHeader`, `SectionHeader` (`page.tsx`) | page chrome |
| `StatCard` (`stat-card.tsx`) | KPI tiles: `<StatCard label="Low stock" value={12} icon={AlertTriangle} tone="warning" href="…" />` |
| `EmptyState` (`empty-state.tsx`) | "no data yet" with icon, description and CTA |
| `LoadingState`, `ErrorState`, `ListSkeleton`, `StatsSkeleton`, `PageSkeleton` (`states.tsx`) | loading / error UI. Every data view needs loading, empty and error states — no flash of "No items" before data arrives |
| `StockStatusBadge`, `LotStatusBadge`, `TransactionTypeBadge` (`status-badge.tsx`) | status pills — never hand-roll status colors |
| `SearchInput` (`search-input.tsx`) | search field with clear button |
| `useConfirm()` (`confirm-provider.tsx`) | **replaces `window.confirm`**: `if (await confirm({ title: "Delete item?", description: "…", destructive: true })) …` |
| `Badge` variants | `default secondary outline success warning danger info muted` |

Never use `alert()`, `confirm()` or `prompt()`. Success/failure feedback → `toast.success(...)` / `toast.error(getErrorMessage(err))`.

## Data
- Workspace: `const { workspaceId, workspace, user, role, isAdmin, isOwner } = useWorkspace()` from `@/lib/workspace-context`. **Never read `localStorage.currentWorkspaceId` directly.** The layout only renders pages once `workspaceId` is set, and remounts the page when the user switches workspace.
- API calls: `lib/api/*.api.ts` functions (they go through `lib/api/client.ts`, which handles auth redirects and error messages). Errors are `ApiError` with `.message` ready to show; use `getErrorMessage(err, "fallback")` from `@/lib/api/client`.
- Fetch pattern: a `load` function in `useCallback`, called from `useEffect([load])`; keep `loading`, `error` state; refetch after mutations (or update local state optimistically).
- Hide admin-only actions (delete, settings, member management) when `!isAdmin`.

## Formatting (`lib/format.ts`, `lib/stock.ts`)
`formatCurrency`, `formatCurrencyCompact`, `formatNumber`, `formatQuantity(qty, unit)`, `formatDate`, `formatDateTime`, `formatRelativeTime`, `getInitials`, `locationLabel(location)`, `getStockStatus`, `getLotStatus`, `getTransactionType`. Don't hand-roll `toFixed`/`toLocaleString`.
- SKUs, item numbers, location codes, lot numbers, barcodes: `font-mono`.
- Numbers in tables: right-aligned, `tabular-nums`.

## Dialogs
`components/ui/dialog` renders as a bottom sheet on phones and a centered modal on desktop, with internal scrolling — don't add your own fixed-position/100vh hacks. Width: `className="sm:max-w-md|lg|xl|2xl"`. Use `DialogHeader/DialogTitle/DialogDescription` + `DialogFooter` with `[Cancel (outline)] [Primary]`. Forms inside dialogs use `<form onSubmit>` so Enter submits; disable the submit button and show `<Loader2 className="animate-spin" />` while saving.

## Tests
Keep every existing `data-testid` attribute (Playwright e2e tests in `tests/e2e` rely on them). Add `data-testid` to new primary actions.
