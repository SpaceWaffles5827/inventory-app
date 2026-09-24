"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { logoutUserApi } from "@/lib/api/auth.api"
import { useWorkspace, WORKSPACE_STORAGE_KEY } from "@/lib/workspace-context"
import { getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

export async function logout() {
  try {
    await logoutUserApi()
  } catch {
    // even if the server call fails, drop local state and go to login
  }
  try {
    localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  } catch {
    // storage unavailable — nothing to clear
  }
  // Full page load on purpose: drops every piece of in-memory client state from the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login")
}

export function ThemeRadioItems() {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
      <DropdownMenuRadioItem value="light" className="gap-2">
        <Sun className="size-4" /> Light
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark" className="gap-2">
        <Moon className="size-4" /> Dark
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system" className="gap-2">
        <Monitor className="size-4" /> System
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  )
}

export function UserAvatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{getInitials(name, "U")}</AvatarFallback>
    </Avatar>
  )
}

/** Desktop sidebar footer: avatar + name, opens account menu */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useWorkspace()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Account menu"
          >
            <UserAvatar name={user?.name} />
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            data-testid="user-menu"
          >
            <UserAvatar name={user?.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user?.name || "Account"}</span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align={compact ? "end" : "start"} side={compact ? "bottom" : "top"}>
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user?.name || "Account"}</div>
          <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2">
          <Link href="/dashboard/settings">
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Theme</DropdownMenuLabel>
        <ThemeRadioItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} variant="destructive" className="gap-2" data-testid="logout-button">
          <LogOut className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
