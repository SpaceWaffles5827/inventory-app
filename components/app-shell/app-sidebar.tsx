"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ScanLine, Search } from "lucide-react"
import { BrandMark } from "@/components/app-shell/brand-mark"
import { NAV_GROUPS, isNavActive } from "@/components/app-shell/nav-config"
import { WorkspaceSwitcher } from "@/components/app-shell/workspace-switcher"
import { UserMenu } from "@/components/app-shell/user-menu"
import { useScanner } from "@/components/app-shell/scan-provider"
import { useCommandPalette } from "@/components/app-shell/command-palette"
import { cn } from "@/lib/utils"

/** Desktop (lg+) navigation rail */
export function AppSidebar() {
  const pathname = usePathname()
  const { openScanner } = useScanner()
  const { openPalette } = useCommandPalette()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 items-center px-4">
        <Link href="/dashboard" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <BrandMark className="text-foreground" />
        </Link>
      </div>

      <div className="px-3">
        <WorkspaceSwitcher />
      </div>

      <div className="flex gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={openPalette}
          className="flex h-9 flex-1 items-center gap-2 rounded-md border border-sidebar-border bg-background px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:border-input hover:text-foreground"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium xl:inline-block">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          onClick={openScanner}
          className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          aria-label="Scan barcode"
          title="Scan barcode"
          data-testid="scan-button"
        >
          <ScanLine className="size-4" />
        </button>
      </div>

      <nav className="scrollbar-none mt-2 flex-1 space-y-5 overflow-y-auto px-3 py-3" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-9 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                        )}
                      />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <UserMenu />
      </div>
    </aside>
  )
}
