import Link from "next/link"
import { ChevronDown, Mail } from "lucide-react"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  LEGAL_LAST_UPDATED,
  LEGAL_LAST_UPDATED_ISO,
  LEGAL_LINKS,
} from "@/components/marketing/site-config"
import { cn } from "@/lib/utils"

export interface LegalSection {
  id: string
  title: string
  content: React.ReactNode
}

/** Inline link to the contact address — use this instead of hard-coding emails in legal copy */
export function ContactEmailLink() {
  return <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
}

// Typography for legal copy (no typography plugin installed, so style descendants directly)
const prose = cn(
  "space-y-4 text-[15px] leading-7 text-muted-foreground",
  "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:pl-1 [&_li]:marker:text-muted-foreground/60",
  "[&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline",
  "[&_a:focus-visible]:rounded-sm [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring"
)

function TocLinks({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="space-y-0.5 border-l text-sm">
      {sections.map((section, i) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="-ml-px flex gap-2 border-l border-transparent py-1.5 pl-3 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground/70">{i + 1}.</span>
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  )
}

/** Shared layout for /terms, /privacy, /cookies and /gdpr */
export function LegalPage({
  title,
  summary,
  href,
  sections,
}: {
  title: string
  summary: string
  /** This page's path, used to highlight it in the related links */
  href: string
  sections: LegalSection[]
}) {
  return (
    <MarketingShell>
      <header className="border-b bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm font-semibold text-primary">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-base text-pretty text-muted-foreground">{summary}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated <time dateTime={LEGAL_LAST_UPDATED_ISO}>{LEGAL_LAST_UPDATED}</time>
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-8">
            <nav aria-label="On this page">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
              <TocLinks sections={sections} />
            </nav>
            <nav aria-label="Legal documents">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</p>
              <ul className="space-y-1 text-sm">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={link.href === href ? "page" : undefined}
                      className="block rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 max-w-3xl">
          {/* compact table of contents for small screens */}
          <details className="group mb-8 rounded-xl border bg-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              On this page
              <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <nav aria-label="On this page" className="px-4 pb-4">
              <TocLinks sections={sections} />
            </nav>
          </details>

          <article>
            {sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="scroll-mt-24 border-b py-8 first:pt-0 last:border-b-0"
              >
                <h2 id={`${section.id}-heading`} className="text-xl font-semibold tracking-tight text-foreground">
                  <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                  {section.title}
                </h2>
                <div className={cn("mt-4", prose)}>{section.content}</div>
              </section>
            ))}
          </article>

          <aside
            aria-label="Contact"
            className="mt-6 flex flex-col gap-4 rounded-2xl border bg-muted/40 p-5 sm:flex-row sm:items-center"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Questions about this page?</span> Contact us at{" "}
              <a
                href={CONTACT_MAILTO}
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </aside>
        </div>
      </div>
    </MarketingShell>
  )
}
