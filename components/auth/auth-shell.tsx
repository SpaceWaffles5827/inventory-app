import { History, Layers, MapPin, ScanLine } from "lucide-react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { StockStatusBadge } from "@/components/common/status-badge"

const POINTS = [
  { icon: ScanLine, text: "Scan barcodes and QR labels with any phone camera or handheld scanner" },
  { icon: MapPin, text: "Track stock by zone, aisle, shelf and bin across every location" },
  { icon: Layers, text: "Receive into lots with expiry dates and catch stock before it expires" },
  { icon: History, text: "A full audit history of every adjustment and transfer" },
]

// Illustrative sample data for the brand panel mock
const LOCATIONS = [
  { code: "A-01-03-B", qty: "124" },
  { code: "C-02-01-C", qty: "24" },
]

function BrandPanel() {
  return (
    <aside aria-label="About StockFlow" className="relative isolate hidden overflow-clip border-l bg-muted/40 lg:block">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-50 [mask-image:radial-gradient(ellipse_at_top_right,black_20%,transparent_70%)]" />
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* sticky so the pitch stays in view next to long forms (overflow-clip keeps sticky working) */}
      <div className="sticky top-16 flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-12 xl:px-20">
        <div className="mx-auto w-full max-w-md py-16">
          <p className="text-sm font-semibold text-primary">Inventory & warehouse management</p>
          <p className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-balance">
            Every item, every location, every movement — accounted for.
          </p>
  
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-primary shadow-xs">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
  
          <div aria-hidden className="mt-10 rounded-2xl border bg-card p-4 shadow-xl shadow-primary/5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Pallet wrap 500mm</div>
                <div className="font-mono text-xs text-muted-foreground">PW-500</div>
              </div>
              <StockStatusBadge status="IN_STOCK" />
            </div>
            <div className="mt-4 divide-y rounded-lg border bg-background text-xs">
              {LOCATIONS.map((loc) => (
                <div key={loc.code} className="flex items-center justify-between px-3 py-2">
                  <span className="flex items-center gap-1.5 font-mono">
                    <MapPin className="size-3 text-muted-foreground" />
                    {loc.code}
                  </span>
                  <span className="tabular-nums">
                    <span className="font-medium">{loc.qty}</span> <span className="text-muted-foreground">rolls</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <History className="size-3" />
              Transferred 24 rolls to C-02-01-C · 2 min ago
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

/**
 * Layout for login, signup, password reset and invitation pages:
 * form on the left, brand panel on the right (desktop); single column on mobile.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <div className="grid flex-1 lg:grid-cols-2">
        <main id="main" className="flex justify-center px-4 py-10 sm:px-6 sm:py-16 lg:items-center lg:px-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <BrandPanel />
      </div>
      <SiteFooter variant="compact" />
    </div>
  )
}
