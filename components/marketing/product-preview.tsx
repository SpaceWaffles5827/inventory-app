import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  FolderTree,
  History,
  LayoutDashboard,
  MapPin,
  Package,
  Plus,
  ScanLine,
  Search,
  Truck,
  Users,
} from "lucide-react"
import { BrandMark } from "@/components/marketing/brand"
import { LotStatusBadge, StockStatusBadge } from "@/components/common/status-badge"
import { cn } from "@/lib/utils"

// Illustrative sample data for the product mock — not real customers or metrics.
const SIDEBAR = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Inventory", icon: Package, active: true },
  { label: "Locations", icon: MapPin },
  { label: "Categories", icon: FolderTree },
  { label: "Activity", icon: History },
  { label: "Reports", icon: BarChart3 },
  { label: "Suppliers", icon: Truck },
  { label: "Customers", icon: Users },
]

const STATS = [
  { label: "Items", value: "1,284", icon: Package, tone: "bg-primary/10 text-primary" },
  { label: "Low stock", value: "7", icon: AlertTriangle, tone: "bg-warning/15 text-warning-foreground dark:text-warning" },
  { label: "Locations", value: "142", icon: MapPin, tone: "bg-info/12 text-info" },
  { label: "Expiring lots", value: "3", icon: CalendarClock, tone: "bg-destructive/10 text-destructive" },
]

const ROWS = [
  { name: "Pallet wrap 500mm", sku: "PW-500", location: "A-01-03-B", qty: "148", unit: "rolls", status: "IN_STOCK" },
  { name: "Nitrile gloves (L)", sku: "NG-L-100", location: "B-04-02-A", qty: "12", unit: "boxes", status: "LOW_STOCK" },
  { name: "Shipping box 40×30×30", sku: "SB-403030", location: "C-02-01-C", qty: "620", unit: "ea", status: "IN_STOCK" },
  { name: "Thermal labels 50×25", sku: "TL-5025", location: "A-02-05-A", qty: "0", unit: "rolls", status: "OUT_OF_STOCK" },
  { name: "Packing tape 48mm", sku: "PT-48", location: "A-01-04-A", qty: "86", unit: "rolls", status: "IN_STOCK" },
]

/** Stylised, non-interactive mock of the StockFlow inventory screen, built from the app's own tokens and badges */
export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-5xl", className)}>
      {/* soft glow */}
      <div aria-hidden className="absolute -inset-x-6 -inset-y-8 -z-10 rounded-[2.5rem] bg-primary/10 blur-3xl" />

      <div
        role="img"
        aria-label="Preview of the StockFlow inventory screen showing stock levels by item and location, with low-stock and out-of-stock indicators"
        className="relative overflow-hidden rounded-2xl border bg-card text-left shadow-2xl shadow-primary/10"
      >
        {/* window chrome */}
        <div className="flex h-10 items-center gap-2 border-b bg-muted/50 px-4">
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/60" />
          <span className="mx-auto hidden rounded-md border bg-background px-3 py-0.5 text-[11px] text-muted-foreground sm:block">
            StockFlow · Inventory
          </span>
          <span className="w-10 sm:w-[46px]" />
        </div>

        <div className="grid md:grid-cols-[190px_1fr]">
          {/* sidebar */}
          <div className="hidden border-r bg-sidebar p-3 md:block">
            <BrandMark className="px-1 py-1.5 text-sm text-foreground" />
            <div className="mt-3 flex h-8 items-center gap-2 rounded-md border bg-background px-2 text-xs text-muted-foreground">
              <Search className="size-3.5" />
              Search
            </div>
            <div className="mt-3 space-y-0.5">
              {SIDEBAR.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium",
                    item.active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("size-3.5", item.active ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* main */}
          <div className="min-w-0 p-3 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold tracking-tight sm:text-lg">Inventory</div>
                <div className="truncate text-xs text-muted-foreground">Main warehouse · 1,284 items</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium sm:flex">
                  <Plus className="size-3.5" />
                  Add item
                </span>
                <span className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-sm">
                  <ScanLine className="size-3.5" />
                  Scan
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-background p-2.5 sm:p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{stat.label}</span>
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", stat.tone)}>
                      <stat.icon className="size-3.5" />
                    </span>
                  </div>
                  <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-xl">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border bg-background">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground md:grid-cols-[1.6fr_1fr_1fr_auto_auto]">
                <span>Item</span>
                <span className="hidden md:block">SKU</span>
                <span className="hidden md:block">Location</span>
                <span className="text-right">On hand</span>
                <span className="w-[92px]">Status</span>
              </div>
              {ROWS.map((row) => (
                <div
                  key={row.sku}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-3 py-2.5 text-xs last:border-b-0 md:grid-cols-[1.6fr_1fr_1fr_auto_auto]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground md:hidden">
                      {row.sku} · {row.location}
                    </div>
                  </div>
                  <span className="hidden truncate font-mono text-muted-foreground md:block">{row.sku}</span>
                  <span className="hidden truncate font-mono md:block">{row.location}</span>
                  <span className="text-right tabular-nums">
                    <span className="font-medium">{row.qty}</span>{" "}
                    <span className="hidden text-muted-foreground sm:inline">{row.unit}</span>
                  </span>
                  <span className="w-[92px]">
                    <StockStatusBadge status={row.status} className="text-[11px]" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* floating: scan result */}
      <div
        aria-hidden
        className="absolute -bottom-8 -left-4 hidden w-60 rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-xl sm:block xl:-left-10"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScanLine className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold">Barcode scanned</div>
            <div className="font-mono text-[11px] text-muted-foreground">PW-500</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-xs">
          <span className="truncate">Pallet wrap 500mm</span>
          <span className="shrink-0 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">+24</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="size-3" />
          Received into <span className="font-mono text-foreground">A-01-03-B</span>
        </div>
      </div>

      {/* floating: expiring lot */}
      <div
        aria-hidden
        className="absolute -bottom-12 -right-4 hidden w-56 rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-xl lg:block xl:-right-10"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold">LOT-2291</span>
          <LotStatusBadge status="ACTIVE" className="text-[11px]" />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Nitrile gloves (L) · 40 boxes</div>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/15 px-2.5 py-2 text-xs font-medium text-warning-foreground dark:text-warning">
          <CalendarClock className="size-3.5" />
          Expires in 12 days
        </div>
      </div>
    </div>
  )
}
