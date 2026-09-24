"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, Menu } from "lucide-react"
import { BrandMark } from "@/components/marketing/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HEADER_LINKS } from "@/components/marketing/site-config"
import { cn } from "@/lib/utils"

/** Sticky header shared by the landing, pricing, legal and auth pages */
export function SiteHeader() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const isCurrent = (href: string) => !href.includes("#") && pathname === href
  const showLogin = pathname !== "/login"
  const showSignup = pathname !== "/signup"

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="StockFlow home"
          className="-m-1 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark className="text-foreground" />
        </Link>

        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
          {HEADER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isCurrent(link.href)
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          {showLogin && (
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login" data-testid="header-login-link">
                Log in
              </Link>
            </Button>
          )}
          {showSignup && (
            <Button asChild size="sm" className="sm:h-9 sm:px-4">
              <Link href="/signup" data-testid="header-signup-link">
                Get started
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <BrandMark />
            </DialogTitle>
            <DialogDescription className="sr-only">Site navigation</DialogDescription>
          </DialogHeader>
          <nav aria-label="Mobile">
            <ul className="-mx-2 space-y-0.5">
              {HEADER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isCurrent(link.href) ? "page" : undefined}
                    className="flex h-12 items-center justify-between rounded-lg px-3 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-primary"
                  >
                    {link.label}
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid gap-2 border-t pt-4">
            <Button asChild size="lg">
              <Link href="/signup" onClick={() => setMenuOpen(false)}>
                Get started
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login" onClick={() => setMenuOpen(false)}>
                Log in
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
