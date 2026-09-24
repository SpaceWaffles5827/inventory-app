"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { LogOut, Menu, Monitor, Moon, ScanLine, Search, Sun } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NAV_GROUPS, MOBILE_TABS, isNavActive } from "@/components/app-shell/nav-config"
import { WorkspaceSwitcher } from "@/components/app-shell/workspace-switcher"
import { UserAvatar, UserMenu, logout } from "@/components/app-shell/user-menu"
import { BrandMark } from "@/components/app-shell/brand-mark"
import { useScanner } from "@/components/app-shell/scan-provider"
import { useCommandPalette } from "@/components/app-shell/command-palette"
import { useWorkspace } from "@/lib/workspace-context"
import { cn } from "@/lib/utils"

/** Top bar shown below lg */
export function MobileTopBar() {
  const { openPalette } = useCommandPalette()
  const { workspace } = useWorkspace()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-lg lg:hidden">
      <Link href="/dashboard" className="min-w-0 flex-1">
        <BrandMark className="text-base" />
        <span className="sr-only">{workspace?.name}</span>
      </Link>
      <button
        type="button"
        onClick={openPalette}
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Search"
      >
        <Search className="size-5" />
      </button>
      <UserMenu compact />
    </header>
  )
}

/** Bottom tab bar shown below lg: 3 tabs, a raised scan button, and "More" */
export function MobileTabBar() {
  const pathname = usePathname()
  const { openScanner } = useScanner()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = !MOBILE_TABS.some((t) => isNavActive(pathname, t.href))

  const tab = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground active:text-foreground"
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  )

  return (
    <>
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-lg lg:hidden"
        aria-label="Main"
      >
        <div className="flex h-16 items-stretch px-1">
          {tab(MOBILE_TABS[0].href, MOBILE_TABS[0].name, MOBILE_TABS[0].icon, isNavActive(pathname, MOBILE_TABS[0].href))}
          {tab(MOBILE_TABS[1].href, MOBILE_TABS[1].name, MOBILE_TABS[1].icon, isNavActive(pathname, MOBILE_TABS[1].href))}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={openScanner}
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95"
              aria-label="Scan barcode"
              data-testid="scan-button-mobile"
            >
              <ScanLine className="size-6" />
            </button>
          </div>
          {tab(MOBILE_TABS[2].href, MOBILE_TABS[2].name, MOBILE_TABS[2].icon, isNavActive(pathname, MOBILE_TABS[2].href))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground active:text-foreground"
            )}
          >
            <Menu className="size-5" />
            More
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}

function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname()
  const { user } = useWorkspace()
  const { theme, setTheme } = useTheme()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <DialogHeader className="sr-only">
          <DialogTitle>Menu</DialogTitle>
          <DialogDescription>Navigate, switch workspace or sign out</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <UserAvatar name={user?.name} className="size-10" />
          <div className="min-w-0">
            <div className="truncate font-medium">{user?.name || "Account"}</div>
            <div className="truncate text-sm text-muted-foreground">{user?.email}</div>
          </div>
        </div>

        <div className="rounded-lg border">
          <WorkspaceSwitcher onSwitched={() => onOpenChange(false)} />
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.label}</div>
            <div className="grid grid-cols-3 gap-2">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors",
                      active ? "border-primary/40 bg-primary/5 text-primary" : "hover:bg-accent"
                    )}
                  >
                    <item.icon className="size-5" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        <div>
          <div className="pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Theme</div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {[
              { value: "light", label: "Light", Icon: Sun },
              { value: "dark", label: "Dark", Icon: Moon },
              { value: "system", label: "System", Icon: Monitor },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors",
                  theme === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium text-destructive hover:bg-destructive/5"
        >
          <LogOut className="size-4" /> Log out
        </button>
      </DialogContent>
    </Dialog>
  )
}
