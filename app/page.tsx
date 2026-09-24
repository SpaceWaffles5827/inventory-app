import { Fragment } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  ChevronRight,
  Layers,
  MapPin,
  Printer,
  ScanLine,
  Smartphone,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StockStatusBadge, TransactionTypeBadge } from "@/components/common/status-badge"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { ProductPreview } from "@/components/marketing/product-preview"
import { FaqList, GridBackdrop, SectionHeading, type FaqItem } from "@/components/marketing/section"
import { CtaBanner } from "@/components/marketing/cta-banner"
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/components/marketing/site-config"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: { absolute: "StockFlow — Inventory & Warehouse Management" },
  description:
    "Track stock across every location, bin and batch. Scan barcodes with any phone, print labels, move stock with a full audit trail and get low-stock alerts.",
}

const HIGHLIGHTS: { label: string; icon: LucideIcon }[] = [
  { label: "Multi-location stock", icon: MapPin },
  { label: "Lots & expiry dates", icon: Layers },
  { label: "Barcode & QR scanning", icon: ScanLine },
  { label: "Full audit history", icon: ArrowLeftRight },
  { label: "Printable PDF labels", icon: Printer },
  { label: "Team roles", icon: Users },
]

export default function LandingPage() {
  return (
    <MarketingShell>
      <Hero />
      <Highlights />
      <Features />
      <HowItWorks />
      <Faq />
      <CtaBanner />
    </MarketingShell>
  )
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden">
      <GridBackdrop />
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur sm:text-sm">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ScanLine className="size-3" />
            </span>
            Barcode scanning with any phone camera
          </p>
          <h1
            id="hero-heading"
            className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl lg:leading-[1.05]"
          >
            Know what you have, and <span className="text-primary">exactly where it is</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
            StockFlow is inventory and warehouse management for growing teams. Track stock across every location, bin and
            batch, move it with a scan, and keep a complete history of every change.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-11 px-6 text-base shadow-sm shadow-primary/20">
              <Link href="/signup" data-testid="hero-signup-link">
                Start free
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6 text-base">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {["14-day free trial", "No credit card required", "Works on phone, tablet and desktop"].map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Check className="size-4 text-success" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview className="mt-14 sm:mt-16" />
      </div>
    </section>
  )
}

function Highlights() {
  return (
    <section aria-label="Highlights" className="border-y bg-muted/30">
      <ul className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
        {HIGHLIGHTS.map(({ label, icon: Icon }) => (
          <li key={label} className="flex items-center gap-2.5 text-sm font-medium">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon: Icon,
  title,
  children,
  visual,
  className,
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
  visual?: React.ReactNode
  className?: string
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-6 text-card-foreground shadow-xs transition-colors hover:border-primary/30",
        className
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
      {visual && (
        <div aria-hidden className="mt-6 flex flex-1 items-end">
          {visual}
        </div>
      )}
    </article>
  )
}

function LocationVisual() {
  const levels = [
    ["Zone", "A"],
    ["Aisle", "01"],
    ["Shelf", "03"],
    ["Bin", "B"],
  ]
  return (
    <div className="w-full rounded-xl border bg-background p-4">
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
        {levels.map(([label, value], i) => (
          <Fragment key={label}>
            {i > 0 && <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" />}
            <div className="min-w-0 rounded-lg border bg-card px-2 py-1.5 sm:px-2.5">
              <div className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              <div className="font-mono text-sm font-semibold">{value}</div>
            </div>
          </Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="text-muted-foreground">Location code</span>
        <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-sm font-semibold text-primary">A-01-03-B</span>
      </div>
    </div>
  )
}

function ScanVisual() {
  // Barcode bar widths (px); purely decorative
  const bars = [2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1]
  return (
    <div className="relative flex w-full items-center justify-center rounded-xl border bg-background px-6 py-6">
      <span className="absolute left-3 top-3 size-4 rounded-tl-md border-l-2 border-t-2 border-primary" />
      <span className="absolute right-3 top-3 size-4 rounded-tr-md border-r-2 border-t-2 border-primary" />
      <span className="absolute bottom-3 left-3 size-4 rounded-bl-md border-b-2 border-l-2 border-primary" />
      <span className="absolute bottom-3 right-3 size-4 rounded-br-md border-b-2 border-r-2 border-primary" />
      <div className="relative">
        <div className="flex h-12 items-stretch gap-[2px]">
          {bars.map((w, i) => (
            <span key={i} className="bg-foreground/85" style={{ width: w * 2 }} />
          ))}
        </div>
        <span className="absolute inset-x-[-8px] top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
        <div className="mt-1.5 text-center font-mono text-[11px] tracking-[0.2em] text-muted-foreground">PW-500</div>
      </div>
    </div>
  )
}

function LotVisual() {
  return (
    <div className="w-full space-y-2 rounded-xl border bg-background p-3 text-xs">
      {[
        { lot: "LOT-2291", expiry: "Expires in 12 days", tone: "bg-warning/15 text-warning-foreground dark:text-warning" },
        { lot: "LOT-2340", expiry: "Expires Mar 2027", tone: "bg-muted text-muted-foreground" },
      ].map((row) => (
        <div key={row.lot} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-2">
          <span className="font-mono font-semibold">{row.lot}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", row.tone)}>{row.expiry}</span>
        </div>
      ))}
    </div>
  )
}

function AuditVisual() {
  const entries = [
    { type: "TRANSFER", what: "12 × PW-500", detail: "A-01-03-B → C-02-01-C", who: "Sam", when: "2 min ago" },
    { type: "OUTPUT", what: "3 × NG-L-100", detail: "Adjustment · damaged in transit", who: "Priya", when: "1 h ago" },
    { type: "INPUT", what: "48 × SB-403030", detail: "Received into LOT-2291", who: "Alex", when: "Yesterday" },
  ]
  return (
    <ol className="w-full divide-y rounded-xl border bg-background">
      {entries.map((e) => (
        <li key={e.what} className="flex items-center gap-3 px-3 py-2.5 text-xs">
          <TransactionTypeBadge type={e.type} className="w-[72px] shrink-0 text-[11px]" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono font-medium">{e.what}</div>
            <div className="truncate text-muted-foreground">{e.detail}</div>
          </div>
          <div className="hidden shrink-0 text-right text-muted-foreground sm:block">
            <div className="font-medium text-foreground">{e.who}</div>
            <div>{e.when}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Decorative 9×9 "QR" pattern — three finder squares plus fixed data modules */
function QrGlyph({ className }: { className?: string }) {
  const data = [
    [4, 0], [4, 2], [3, 4], [5, 4], [4, 5], [6, 4], [8, 4], [4, 7], [4, 8], [6, 6], [7, 7], [8, 6], [6, 8], [8, 8], [0, 4], [2, 4],
  ]
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={3} height={3} fill="currentColor" />
      <rect x={x + 0.5} y={y + 0.5} width={2} height={2} fill="white" />
      <rect x={x + 1} y={y + 1} width={1} height={1} fill="currentColor" />
    </g>
  )
  return (
    <svg viewBox="0 0 9 9" className={className} shapeRendering="crispEdges">
      {finder(0, 0)}
      {finder(6, 0)}
      {finder(0, 6)}
      {data.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
      ))}
    </svg>
  )
}

function LabelVisual() {
  // Printable label preview — white paper in both themes (allowed exception to the token rule)
  return (
    <div className="flex w-full justify-center rounded-xl border bg-background p-4">
      <div className="flex w-full max-w-[240px] items-center gap-3 rounded-md bg-white p-3 text-black shadow-md ring-1 ring-black/10">
        <QrGlyph className="size-14 shrink-0" />
        <div className="min-w-0">
          <div className="font-mono text-base font-bold leading-tight">A-01-03-B</div>
          <div className="mt-0.5 text-[10px] leading-snug text-black/60">Zone A · Aisle 01 · Shelf 03 · Bin B</div>
        </div>
      </div>
    </div>
  )
}

function AlertsVisual() {
  const rows = [
    { name: "Nitrile gloves (L)", onHand: 12, reorder: 20, status: "LOW_STOCK" },
    { name: "Thermal labels 50×25", onHand: 0, reorder: 10, status: "OUT_OF_STOCK" },
  ]
  return (
    <div className="w-full space-y-3 rounded-xl border bg-background p-3 text-xs">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{row.name}</span>
            <StockStatusBadge status={row.status} className="text-[11px]" />
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full", row.onHand > 0 ? "bg-warning" : "bg-destructive")}
                style={{ width: `${Math.max(4, (row.onHand / row.reorder) * 100)}%` }}
              />
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {row.onHand} / reorder at {row.reorder}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function PartnersVisual() {
  const partners = [
    { name: "Northwind Supplies", kind: "Supplier", detail: "Supplies 14 items", icon: Truck },
    { name: "Contoso Retail", kind: "Customer", detail: "Buys 6 items", icon: Store },
  ]
  return (
    <ul className="w-full divide-y rounded-xl border bg-background text-xs">
      {partners.map(({ name, kind, detail, icon: Icon }) => (
        <li key={name} className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{name}</div>
            <div className="text-muted-foreground">{detail}</div>
          </div>
          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{kind}</span>
        </li>
      ))}
    </ul>
  )
}

function ReportsVisual() {
  const bars = [40, 55, 48, 70, 62, 84, 76]
  return (
    <div className="flex h-24 w-full items-end gap-1.5 rounded-xl border bg-background px-3 pb-3 pt-4">
      {bars.map((h, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-t-sm", i === bars.length - 1 ? "bg-chart-1" : "bg-chart-1/30")}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

function TeamVisual() {
  const members = [
    { initials: "JM", name: "Jordan", role: "Owner", tone: "bg-primary/10 text-primary" },
    { initials: "PS", name: "Priya", role: "Admin", tone: "bg-info/12 text-info" },
    { initials: "SK", name: "Sam", role: "Member", tone: "bg-muted text-muted-foreground" },
  ]
  return (
    <div className="grid w-full gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[1fr_auto]">
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.name} className="flex items-center gap-2.5 text-xs">
            <span className={cn("flex size-7 items-center justify-center rounded-full text-[11px] font-semibold", m.tone)}>
              {m.initials}
            </span>
            <span className="flex-1 font-medium">{m.name}</span>
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{m.role}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-row flex-wrap gap-2 border-t pt-3 sm:flex-col sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
        {["Main warehouse", "Retail store", "Spare parts"].map((ws, i) => (
          <span
            key={ws}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
              i === 0 ? "border-primary/40 bg-primary/10 text-primary" : "bg-card text-muted-foreground"
            )}
          >
            {ws}
          </span>
        ))}
      </div>
    </div>
  )
}

function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="features-heading"
          eyebrow="Features"
          title="Everything you need to run a tidy stockroom"
          description="From the receiving dock to the pick shelf: know where every unit lives, what batch it came from, and who moved it."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          <FeatureCard icon={MapPin} title="Multi-location stock" visual={<LocationVisual />} className="sm:col-span-2">
            Track quantities per location with a structure that matches your building — zones, aisles, shelves and bins
            — so everyone knows exactly where to put away and where to pick.
          </FeatureCard>
          <FeatureCard icon={ScanLine} title="Barcode & QR scanning" visual={<ScanVisual />}>
            Scan with any phone or tablet camera, or plug in a handheld scanner. Jump straight to an item or location
            and act on it.
          </FeatureCard>
          <FeatureCard icon={Layers} title="Lots, batches & expiry" visual={<LotVisual />}>
            Receive stock into lots with expiry dates and see what&apos;s expiring soon, before it becomes waste.
          </FeatureCard>
          <FeatureCard
            icon={ArrowLeftRight}
            title="Adjustments & transfers with a full audit trail"
            visual={<AuditVisual />}
            className="sm:col-span-2"
          >
            Every adjustment and transfer between locations is recorded with who, what, when and why — so you can
            answer &ldquo;where did it go?&rdquo; in seconds.
          </FeatureCard>
          <FeatureCard icon={Printer} title="Printable labels" visual={<LabelVisual />}>
            Generate barcode and QR labels for items and locations as print-ready PDFs, then stick them on shelves,
            bins and boxes.
          </FeatureCard>
          <FeatureCard icon={BellRing} title="Low-stock alerts" visual={<AlertsVisual />}>
            Set a reorder point for each item. Low and out-of-stock items are flagged automatically, so you reorder in
            time.
          </FeatureCard>
          <FeatureCard icon={Truck} title="Suppliers & customers" visual={<PartnersVisual />}>
            Keep supplier and customer records next to the stock they supply and buy, instead of in a separate
            spreadsheet.
          </FeatureCard>
          <FeatureCard icon={BarChart3} title="Reports" visual={<ReportsVisual />}>
            Stock value, turnover, low-stock counts and stock-level trends in one place.
          </FeatureCard>
          <FeatureCard icon={Users} title="Teams & workspaces" visual={<TeamVisual />} className="sm:col-span-2">
            Invite teammates as owners, admins or members, and keep separate workspaces for each business, site or
            client — switch between them in one click.
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    title: "Map your warehouse",
    description:
      "Create a workspace and describe your storage the way it's laid out — zones, aisles, shelves and bins. Print a label for every location.",
    points: ["Your own location structure", "Location labels as PDF"],
  },
  {
    title: "Add items and stock",
    description:
      "Add items with SKUs, barcodes, units and a reorder point. Record stock in each location, and switch on lot tracking for anything with a batch or expiry date.",
    points: ["Categories & suppliers", "Optional lot tracking"],
  },
  {
    title: "Scan, move and track",
    description:
      "Receive, adjust and transfer stock by scanning a label. Every movement lands in the history, and low stock is flagged as soon as it happens.",
    points: ["Phone camera or handheld scanner", "Complete audit history"],
  },
]

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="scroll-mt-20 border-y bg-muted/30 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="From empty spreadsheet to live inventory in three steps"
          description="No hardware to buy and nothing to install. If you have a phone and a printer, you're ready."
        />

        <ol className="mt-14 grid gap-5 md:mt-20 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex flex-col rounded-2xl border bg-card p-6 shadow-xs">
              <span className="flex size-12 items-center justify-center rounded-full border bg-background text-lg font-semibold text-primary shadow-xs md:-mt-12 md:self-center">
                <span className="sr-only">Step </span>
                {i + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight md:text-center">{step.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground md:text-center">
                {step.description}
              </p>
              <ul className="mt-5 space-y-2 border-t pt-4">
                {step.points.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-4 rounded-2xl border bg-card p-5 text-center shadow-xs sm:flex-row sm:text-left">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="size-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Built for the warehouse floor.</span> StockFlow runs in the
            browser on phones, tablets and desktops, with large touch targets and a scan button that&apos;s always one
            tap away.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

const FAQ: FaqItem[] = [
  {
    question: "Do I need special scanning hardware?",
    answer:
      "No. Any phone or tablet with a camera can scan barcodes and QR codes in StockFlow. If you already have a USB or Bluetooth handheld scanner that types like a keyboard, that works too.",
  },
  {
    question: "Can I track the same item in several locations?",
    answer:
      "Yes. Stock is tracked per location, so one item can sit in several bins or buildings with its own quantity in each. Transfers move stock between them and are recorded in the item's history.",
  },
  {
    question: "Does StockFlow handle lots and expiry dates?",
    answer:
      "Yes. Turn on lot tracking for an item to receive stock into lots with their own quantities, locations and expiry dates. Lots that are about to expire are easy to spot.",
  },
  {
    question: "Can my whole team use it?",
    answer:
      "Yes. Invite teammates by email and give them the owner, admin or member role. You can also create separate workspaces — for example one per site or per business — and switch between them.",
  },
  {
    question: "How do labels work?",
    answer:
      "StockFlow generates barcode and QR labels for items and locations as PDF files that you can print on a regular printer or label sheets. Scanning a label takes you straight to that item or location.",
  },
  {
    question: "How much does it cost?",
    answer: (
      <>
        Every plan starts with a 14-day free trial and no credit card is required. See the{" "}
        <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">
          pricing page
        </Link>{" "}
        for plan details, or email{" "}
        <a href={CONTACT_MAILTO} className="font-medium text-primary underline-offset-4 hover:underline">
          {CONTACT_EMAIL}
        </a>{" "}
        with any questions.
      </>
    ),
  },
]

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 pb-4 pt-20 sm:pb-8 sm:pt-28">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <SectionHeading
          id="faq-heading"
          eyebrow="FAQ"
          title="Questions, answered"
          description={
            <>
              Can&apos;t find what you&apos;re looking for?{" "}
              <a href={CONTACT_MAILTO} className="font-medium text-primary underline-offset-4 hover:underline">
                Get in touch
              </a>{" "}
              and we&apos;ll help you get set up.
            </>
          }
          align="left"
        />
        <FaqList items={FAQ} />
      </div>
    </section>
  )
}
