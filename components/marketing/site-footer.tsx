import Link from "next/link"
import { Mail } from "lucide-react"
import { BrandMark } from "@/components/marketing/brand"
import { CONTACT_EMAIL, CONTACT_MAILTO, FOOTER_GROUPS, LEGAL_LINKS, SITE_NAME } from "@/components/marketing/site-config"
import { cn } from "@/lib/utils"

const linkClass =
  "rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={linkClass}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  )
}

function Copyright() {
  return (
    <p className="text-sm text-muted-foreground">
      © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
    </p>
  )
}

/**
 * Site footer. `full` (default) for marketing and legal pages, `compact` (a single row) for auth pages.
 */
export function SiteFooter({ variant = "full", className }: { variant?: "full" | "compact"; className?: string }) {
  if (variant === "compact") {
    return (
      <footer className={cn("border-t", className)}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Copyright />
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href}>{link.short ?? link.label}</FooterLink>
                </li>
              ))}
              <li>
                <FooterLink href={CONTACT_MAILTO}>Contact</FooterLink>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    )
  }

  return (
    <footer className={cn("border-t bg-muted/30", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 max-w-xs space-y-4 sm:col-span-3 lg:col-span-1">
            <Link
              href="/"
              aria-label="StockFlow home"
              className="-m-1 inline-flex rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BrandMark className="text-foreground" />
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Inventory and warehouse management for teams that need to know what they have, and exactly where it is.
            </p>
            <a
              href={CONTACT_MAILTO}
              className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Mail className="size-4 text-muted-foreground" />
              {CONTACT_EMAIL}
            </a>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-labelledby={`footer-${group.title.toLowerCase()}`}>
              <h2 id={`footer-${group.title.toLowerCase()}`} className="text-sm font-semibold text-foreground">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Copyright />
          <p className="text-sm text-muted-foreground">Made for stockrooms, warehouses and the people who run them.</p>
        </div>
      </div>
    </footer>
  )
}
