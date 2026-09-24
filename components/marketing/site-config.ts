// Shared copy + links for the public (marketing, legal and auth) pages.

export const SITE_NAME = "StockFlow"

// TODO: set real contact email
export const CONTACT_EMAIL = "support@stockflow.app"
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`

/** Shown on every legal page */
export const LEGAL_LAST_UPDATED = "September 24, 2026"
export const LEGAL_LAST_UPDATED_ISO = "2026-09-24"

export interface SiteLink {
  label: string
  href: string
  /** Shorter label for tight spaces (compact footer) */
  short?: string
}

/** Primary navigation in the marketing header */
export const HEADER_LINKS: SiteLink[] = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
]

export const FOOTER_GROUPS: { title: string; links: SiteLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact us", href: CONTACT_MAILTO },
      { label: "Log in", href: "/login" },
      { label: "Create an account", href: "/signup" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms", short: "Terms" },
      { label: "Privacy Policy", href: "/privacy", short: "Privacy" },
      { label: "Cookie Policy", href: "/cookies", short: "Cookies" },
      { label: "GDPR", href: "/gdpr" },
    ],
  },
]

export const LEGAL_LINKS: SiteLink[] = FOOTER_GROUPS[2].links
