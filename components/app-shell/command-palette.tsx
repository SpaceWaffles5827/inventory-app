"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { MapPin, Moon, Package, Plus, ScanLine, Sun } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { ALL_NAV_ITEMS } from "@/components/app-shell/nav-config"
import { useScanner } from "@/components/app-shell/scan-provider"
import { useWorkspace } from "@/lib/workspace-context"
import { getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"

interface CommandPaletteContextValue {
  openPalette: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { workspaceId } = useWorkspace()
  const { openScanner } = useScanner()
  const { resolvedTheme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ItemWithRelations[]>([])
  const [locations, setLocations] = useState<LocationWithCount[]>([])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Load searchable records each time the palette opens so results are fresh.
  useEffect(() => {
    if (!open || !workspaceId) return
    let cancelled = false
    Promise.allSettled([getItemsApi(workspaceId), getLocationsApi(workspaceId)]).then(([itemsRes, locRes]) => {
      if (cancelled) return
      if (itemsRes.status === "fulfilled") setItems(itemsRes.value.data?.items ?? [])
      if (locRes.status === "fulfilled") setLocations(locRes.value.data?.locations ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [open, workspaceId])

  const run = useCallback((fn: () => void) => {
    setOpen(false)
    fn()
  }, [])

  const value = useMemo(() => ({ openPalette: () => setOpen(true) }), [])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search items, locations and pages">
        <CommandInput placeholder="Search items, locations, pages…" />
        <CommandList className="max-h-[60dvh]">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => run(openScanner)}>
              <ScanLine /> Scan a barcode
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/dashboard/items?new=1"))}>
              <Plus /> Add item
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />} Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Pages">
            {ALL_NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.name} ${(item.keywords ?? []).join(" ")}`}
                onSelect={() => run(() => router.push(item.href))}
              >
                <item.icon /> {item.name}
              </CommandItem>
            ))}
          </CommandGroup>
          {items.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Items">
                {items.slice(0, 200).map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`item ${item.name} ${item.itemNumber} ${item.barcode ?? ""}`}
                    onSelect={() => run(() => router.push(`/dashboard/items/${item.id}`))}
                  >
                    <Package />
                    <span className="truncate">{item.name}</span>
                    <CommandShortcut className="font-mono tracking-normal">{item.itemNumber}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {locations.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Locations">
                {locations.slice(0, 200).map((loc) => (
                  <CommandItem
                    key={loc.id}
                    value={`location ${loc.code} ${loc.description ?? ""} ${loc.barcode ?? ""}`}
                    onSelect={() => run(() => router.push(`/dashboard/locations/${loc.id}`))}
                  >
                    <MapPin />
                    <span className="font-mono">{loc.code}</span>
                    {loc.description && <span className="truncate text-muted-foreground">{loc.description}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  )
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>")
  return ctx
}
