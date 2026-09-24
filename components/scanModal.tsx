"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Eye,
  Layers,
  MapPin,
  Minus,
  Plus,
  ScanLine,
  SearchX,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ErrorState } from "@/components/common/states"
import { StockStatusBadge } from "@/components/common/status-badge"
import { CameraScanner, type ScanFlash } from "@/components/scanner/camera-scanner"
import { playScanFeedback } from "@/components/scanner/feedback"
import { findItemByCode, findLocationByCode } from "@/components/scanner/lookup"
import { ManualCodeEntry } from "@/components/scanner/manual-code-entry"
import { focusDialogOnTouch, useFinePointer } from "@/components/scanner/pointer"
import { useKeyboardWedge } from "@/components/scanner/use-keyboard-wedge"
import { AdjustStockDialog } from "@/components/stock/adjust-stock-dialog"
import { BatchAdjustDialog, type BatchAdjustResult } from "@/components/stock/batch-adjust-dialog"
import { ItemThumb } from "@/components/stock/stock-summary"
import { TransferStockDialog } from "@/components/stock/transfer-stock-dialog"
import type { StockDirection, StockItem } from "@/components/stock/stock-utils"
import { getItemByIdApi, getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatNumber, formatQuantity } from "@/lib/format"
import { deriveStockStatus } from "@/lib/stock"
import { cn } from "@/lib/utils"

interface ScanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Workspace items (prefetched by the app shell). The modal fetches them itself if this is empty. */
  allItems: ItemWithRelations[]
  currentWorkspaceId: string
}

/** Global "Scan" from the nav: scan or type any code → item or location card with quick actions */
export function ScanModal({ open, onOpenChange, allItems, currentWorkspaceId }: ScanModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col gap-0 overflow-hidden p-0 pb-0 sm:max-w-lg sm:p-0 sm:pb-0"
        onOpenAutoFocus={focusDialogOnTouch}
        data-testid="scan-modal"
      >
        {/* Unmounted while closed: every open starts a fresh session and the camera stops on close */}
        <ScanSession allItems={allItems} workspaceId={currentWorkspaceId} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

type ScanItem = StockItem & ItemWithRelations

type ScanMatch = { kind: "item"; item: ScanItem } | { kind: "location"; location: LocationWithCount }

type LookupState =
  | { code: string; status: "loading" }
  | { code: string; status: "done"; matches: ScanMatch[] }
  | { code: string; status: "error"; message: string }

type SubFlow =
  | { kind: "adjust"; item: ScanItem; direction: StockDirection; locationId: string | null }
  | { kind: "transfer"; item: ScanItem }
  | { kind: "batch"; direction: StockDirection }

interface TallyEntry {
  item: ScanItem
  quantity: number
}

interface BatchNotice {
  tone: "success" | "info" | "error"
  text: string
}

function ScanSession({
  allItems,
  workspaceId,
  onClose,
}: {
  allItems: ItemWithRelations[]
  workspaceId: string
  onClose: () => void
}) {
  const router = useRouter()
  const finePointer = useFinePointer()
  const [lookup, setLookup] = useState<LookupState | null>(null)
  const [flash, setFlash] = useState<ScanFlash>(null)
  const [flow, setFlow] = useState<SubFlow | null>(null)
  const [contextLocation, setContextLocation] = useState<LocationWithCount | null>(null)
  const [fresh, setFresh] = useState<Record<string, ScanItem>>({})
  const [batchMode, setBatchMode] = useState(false)
  const [tally, setTally] = useState<TallyEntry[]>([])
  const [notice, setNotice] = useState<BatchNotice | null>(null)

  const requestRef = useRef(0)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemsCache = useRef<Promise<ItemWithRelations[]> | null>(null)
  const locationsCache = useRef<Promise<LocationWithCount[]> | null>(null)

  const loadLocations = useCallback((): Promise<LocationWithCount[]> => {
    if (!locationsCache.current) {
      const request = getLocationsApi(workspaceId).then((res) => res.data?.locations ?? [])
      request.catch(() => {
        locationsCache.current = null
      })
      locationsCache.current = request
    }
    return locationsCache.current
  }, [workspaceId])

  // Warm the location list so the first location scan resolves instantly.
  useEffect(() => {
    loadLocations().catch(() => {})
  }, [loadLocations])

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    []
  )

  const loadItems = (): Promise<ItemWithRelations[]> => {
    if (allItems.length > 0) return Promise.resolve(allItems)
    if (!itemsCache.current) {
      const request = getItemsApi(workspaceId).then((res) => res.data?.items ?? [])
      request.catch(() => {
        itemsCache.current = null
      })
      itemsCache.current = request
    }
    return itemsCache.current
  }

  const showFlash = (kind: "success" | "error") => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(kind)
    flashTimer.current = setTimeout(() => setFlash(null), 700)
  }

  const withFresh = (item: ItemWithRelations): ScanItem => fresh[item.id] ?? (item as ScanItem)

  const resolve = async (code: string): Promise<ScanMatch[]> => {
    const [items, locations] = await Promise.all([
      loadItems(),
      loadLocations().catch(() => [] as LocationWithCount[]),
    ])
    const item = findItemByCode(items, code)
    const location = findLocationByCode(locations, code)
    const matches: ScanMatch[] = []
    if (item) matches.push({ kind: "item", item: withFresh(item) })
    if (location) matches.push({ kind: "location", location })
    return matches
  }

  const addToBatch = (code: string, matches: ScanMatch[]) => {
    const itemMatch = matches.find((m): m is Extract<ScanMatch, { kind: "item" }> => m.kind === "item")
    if (itemMatch) {
      const item = itemMatch.item
      setTally((prev) => {
        const existing = prev.find((e) => e.item.id === item.id)
        const rest = prev.filter((e) => e.item.id !== item.id)
        return [{ item, quantity: (existing?.quantity ?? 0) + 1 }, ...rest]
      })
      setNotice({ tone: "success", text: `+1 ${item.name}` })
      showFlash("success")
      return
    }
    const locationMatch = matches.find((m): m is Extract<ScanMatch, { kind: "location" }> => m.kind === "location")
    if (locationMatch) {
      setContextLocation(locationMatch.location)
      setNotice({ tone: "info", text: `Location ${locationMatch.location.code} selected` })
      showFlash("success")
      return
    }
    setNotice({ tone: "error", text: `No item found for ${code}` })
    showFlash("error")
    playScanFeedback("error")
  }

  const handleCode = async (raw: string, source: "camera" | "typed") => {
    const code = raw.trim()
    if (!code || flow) return
    // The camera keeps seeing the barcode that's already on screen — ignore it.
    if (!batchMode && source === "camera" && lookup && lookup.code === code && lookup.status !== "error") return

    const id = ++requestRef.current
    if (!batchMode) setLookup({ code, status: "loading" })
    try {
      const matches = await resolve(code)
      if (batchMode) {
        addToBatch(code, matches)
        return
      }
      if (id !== requestRef.current) return
      setLookup({ code, status: "done", matches })
      const onlyLocation = matches.length === 1 && matches[0].kind === "location" ? matches[0].location : null
      if (onlyLocation) setContextLocation(onlyLocation)
      if (matches.length === 0) {
        showFlash("error")
        playScanFeedback("error")
      } else {
        showFlash("success")
      }
    } catch (err) {
      const message = getErrorMessage(err, "Couldn't look up that code")
      if (batchMode) {
        setNotice({ tone: "error", text: message })
        return
      }
      if (id !== requestRef.current) return
      setLookup({ code, status: "error", message })
      showFlash("error")
    }
  }

  useKeyboardWedge({ enabled: !flow, onScan: (code) => handleCode(code, "typed") })

  const refreshItem = async (itemId: string) => {
    try {
      const res = await getItemByIdApi(itemId)
      const item = res.data?.item
      if (item) setFresh((prev) => ({ ...prev, [itemId]: item as ScanItem }))
    } catch {
      // keep showing the previous numbers
    }
  }

  const go = (href: string) => {
    onClose()
    router.push(href)
  }

  const clearResult = () => {
    requestRef.current += 1
    setLookup(null)
  }

  const handleBatchDone = (result: BatchAdjustResult) => {
    setTally((prev) => prev.filter((e) => !result.succeeded.includes(e.item.id)))
    result.succeeded.forEach((id) => void refreshItem(id))
    if (result.succeeded.length > 0) setNotice(null)
  }

  const setBatch = (on: boolean) => {
    setBatchMode(on)
    setNotice(null)
    clearResult()
  }

  const tallyUnits = tally.reduce((sum, e) => sum + e.quantity, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-primary" aria-hidden />
            Scan
          </DialogTitle>
          <DialogDescription>
            {batchMode
              ? "Scan items one after another, then receive or pick them together."
              : "Scan or type an item barcode, item number or location code."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
          <Label htmlFor="scan-batch-mode" className="flex items-center gap-2 text-sm font-medium">
            <Layers className="size-4 text-muted-foreground" />
            Batch mode
            <span className="hidden font-normal text-muted-foreground sm:inline">· count many items</span>
          </Label>
          <Switch id="scan-batch-mode" checked={batchMode} onCheckedChange={setBatch} data-testid="scan-batch-toggle" />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <CameraScanner
          active={!flow}
          onDetected={(code) => void handleCode(code, "camera")}
          flash={flash}
          dedupeMs={batchMode ? 2000 : 1500}
          hint={batchMode ? "Scan each item once" : "Point the camera at a barcode"}
          className={cn(
            "transition-[height] duration-300",
            lookup || tally.length > 0 ? "h-36 sm:h-44" : "h-56 sm:h-64"
          )}
        />
        <ManualCodeEntry
          onSubmit={(code) => void handleCode(code, "typed")}
          autoFocus={finePointer}
          busy={!batchMode && lookup?.status === "loading"}
          inputTestId="scan-manual-input"
          submitTestId="scan-manual-submit"
        />

        {contextLocation && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <MapPin className="size-4 shrink-0 text-primary" />
            <p className="min-w-0 flex-1">
              Using <span className="font-mono font-semibold">{contextLocation.code}</span>
              <span className="text-muted-foreground">
                {batchMode ? " for this batch" : " for stock in / out"}
              </span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => setContextLocation(null)}
              aria-label="Stop using this location"
            >
              <X />
            </Button>
          </div>
        )}

        {batchMode ? (
          <BatchList
            tally={tally}
            notice={notice}
            onChange={(itemId, quantity) =>
              setTally((prev) =>
                quantity <= 0
                  ? prev.filter((e) => e.item.id !== itemId)
                  : prev.map((e) => (e.item.id === itemId ? { ...e, quantity } : e))
              )
            }
            onClear={() => {
              setTally([])
              setNotice(null)
            }}
          />
        ) : (
          <ResultArea
            lookup={lookup}
            withFresh={withFresh}
            contextLocation={contextLocation}
            onRetry={(code) => void handleCode(code, "typed")}
            onClear={clearResult}
            onViewItem={(id) => go(`/dashboard/items/${id}`)}
            onViewLocation={(id) => go(`/dashboard/locations/${id}`)}
            onCreateItem={(code) => go(`/dashboard/items?new=1&barcode=${encodeURIComponent(code)}`)}
            onAdjust={(item, direction) =>
              setFlow({ kind: "adjust", item, direction, locationId: contextLocation?.id ?? null })
            }
            onTransfer={(item) => setFlow({ kind: "transfer", item })}
          />
        )}
      </div>

      <div className="shrink-0 border-t bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
        {batchMode ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              disabled={tally.length === 0}
              onClick={() => setFlow({ kind: "batch", direction: "out" })}
              data-testid="scan-batch-pick"
            >
              <ArrowUpFromLine /> Pick
            </Button>
            <Button
              type="button"
              className="h-11 flex-[2]"
              disabled={tally.length === 0}
              onClick={() => setFlow({ kind: "batch", direction: "in" })}
              data-testid="scan-batch-receive"
            >
              <ArrowDownToLine /> Receive {tallyUnits > 0 && formatNumber(tallyUnits)}
            </Button>
          </div>
        ) : (
          <div className="flex sm:justify-end">
            <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>

      <AdjustStockDialog
        open={flow?.kind === "adjust"}
        onOpenChange={(open) => !open && setFlow(null)}
        item={flow?.kind === "adjust" ? flow.item : null}
        defaultDirection={flow?.kind === "adjust" ? flow.direction : "in"}
        locationId={flow?.kind === "adjust" ? flow.locationId : null}
        onSuccess={(result) => void refreshItem(result.itemId)}
      />
      <TransferStockDialog
        open={flow?.kind === "transfer"}
        onOpenChange={(open) => !open && setFlow(null)}
        item={flow?.kind === "transfer" ? flow.item : null}
        onSuccess={(result) => void refreshItem(result.itemId)}
      />
      <BatchAdjustDialog
        open={flow?.kind === "batch"}
        onOpenChange={(open) => !open && setFlow(null)}
        entries={tally}
        defaultDirection={flow?.kind === "batch" ? flow.direction : "in"}
        defaultLocationId={contextLocation?.id ?? null}
        onComplete={handleBatchDone}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result cards
// ---------------------------------------------------------------------------

interface ResultAreaProps {
  lookup: LookupState | null
  withFresh: (item: ItemWithRelations) => ScanItem
  contextLocation: LocationWithCount | null
  onRetry: (code: string) => void
  onClear: () => void
  onViewItem: (id: string) => void
  onViewLocation: (id: string) => void
  onCreateItem: (code: string) => void
  onAdjust: (item: ScanItem, direction: StockDirection) => void
  onTransfer: (item: ScanItem) => void
}

function ResultArea({
  lookup,
  withFresh,
  contextLocation,
  onRetry,
  onClear,
  onViewItem,
  onViewLocation,
  onCreateItem,
  onAdjust,
  onTransfer,
}: ResultAreaProps) {
  if (!lookup) {
    return (
      <div className="grid gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <ScanLine className="mt-0.5 size-4 shrink-0" />
          Scan an item&apos;s barcode to see its stock, or a location label to open it.
        </p>
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          Scan a location first, then an item, to stock it in or out right there.
        </p>
      </div>
    )
  }

  if (lookup.status === "loading") {
    return (
      <div className="rounded-xl border bg-card p-4" aria-busy>
        <div className="flex gap-3">
          <Skeleton className="size-16 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  if (lookup.status === "error") {
    return <ErrorState title="Lookup failed" message={lookup.message} onRetry={() => onRetry(lookup.code)} />
  }

  if (lookup.matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-5 text-center" data-testid="scan-not-found">
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-5 text-muted-foreground" />
        </div>
        <p className="font-medium">
          No item or location found for <span className="break-all font-mono">{lookup.code}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Check the code, or add it as a new item.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" className="h-11 sm:h-9" onClick={() => onCreateItem(lookup.code)} data-testid="scan-create-item">
            <Plus /> Create item with this barcode
          </Button>
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClear}>
            Scan again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {lookup.matches.map((match) =>
        match.kind === "item" ? (
          <ItemResultCard
            key={`item-${match.item.id}`}
            item={withFresh(match.item)}
            contextLocation={contextLocation}
            onView={() => onViewItem(match.item.id)}
            onAdjust={(direction) => onAdjust(withFresh(match.item), direction)}
            onTransfer={() => onTransfer(withFresh(match.item))}
          />
        ) : (
          <LocationResultCard
            key={`location-${match.location.id}`}
            location={match.location}
            onView={() => onViewLocation(match.location.id)}
          />
        )
      )}
    </div>
  )
}

function ItemResultCard({
  item,
  contextLocation,
  onView,
  onAdjust,
  onTransfer,
}: {
  item: ScanItem
  contextLocation: LocationWithCount | null
  onView: () => void
  onAdjust: (direction: StockDirection) => void
  onTransfer: () => void
}) {
  const status = deriveStockStatus(item.onHand, item.reorderPoint ?? 10)
  const stocked = [...(item.locations ?? [])].filter((l) => l.quantity > 0).sort((a, b) => b.quantity - a.quantity)
  const shown = stocked.slice(0, 4)
  const atContext = contextLocation ? (item.locations?.find((l) => l.locationId === contextLocation.id)?.quantity ?? 0) : null

  return (
    <div className="rounded-xl border bg-card p-3.5 sm:p-4" data-testid="scan-result-item">
      <div className="flex gap-3">
        <ItemThumb itemId={item.id} alt={item.name} className="size-16" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-tight">{item.name}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {item.itemNumber}
            {item.barcode && item.barcode !== item.itemNumber ? ` · ${item.barcode}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StockStatusBadge status={status} />
            <span className="text-sm">
              <span className="font-semibold tabular-nums">{formatQuantity(item.onHand, item.unit)}</span>
              <span className="text-muted-foreground"> on hand</span>
            </span>
          </div>
        </div>
      </div>

      {shown.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((l) => (
            <span
              key={l.locationId}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs",
                contextLocation?.id === l.locationId && "bg-primary/10 text-primary"
              )}
            >
              <MapPin className="size-3" />
              <span className="font-mono">{l.location.code}</span>
              <span className="tabular-nums text-muted-foreground">{formatNumber(l.quantity)}</span>
            </span>
          ))}
          {stocked.length > shown.length && (
            <span className="inline-flex items-center rounded-md px-2 py-1 text-xs text-muted-foreground">
              +{stocked.length - shown.length} more
            </span>
          )}
        </div>
      )}

      {contextLocation && atContext !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          At <span className="font-mono text-foreground">{contextLocation.code}</span>:{" "}
          <span className="tabular-nums text-foreground">{formatQuantity(atContext, item.unit)}</span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button type="button" variant="outline" className="h-11" onClick={onView} data-testid="scan-action-view">
          <Eye /> View
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onTransfer} disabled={item.onHand <= 0} data-testid="scan-action-transfer">
          <ArrowRightLeft /> Transfer
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => onAdjust("out")}
          disabled={item.onHand <= 0}
          data-testid="scan-action-stock-out"
        >
          <ArrowUpFromLine /> Stock out
        </Button>
        <Button type="button" className="h-11" onClick={() => onAdjust("in")} data-testid="scan-action-stock-in">
          <ArrowDownToLine /> Stock in
        </Button>
      </div>
    </div>
  )
}

function LocationResultCard({ location, onView }: { location: LocationWithCount; onView: () => void }) {
  const count = location._count?.items ?? 0
  const totalUnits = (location as { totalUnits?: unknown }).totalUnits
  return (
    <div className="rounded-xl border bg-card p-3.5 sm:p-4" data-testid="scan-result-location">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MapPin className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono font-semibold">{location.code}</p>
          <p className="truncate text-xs text-muted-foreground">
            {location.description || "Location"} · {formatNumber(count)} item{count === 1 ? "" : "s"}
            {typeof totalUnits === "number" && <> · {formatNumber(totalUnits)} units</>}
          </p>
        </div>
      </div>
      <Button type="button" className="mt-3 h-11 w-full" onClick={onView} data-testid="scan-action-view-location">
        <MapPin /> View location
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Batch mode
// ---------------------------------------------------------------------------

function BatchList({
  tally,
  notice,
  onChange,
  onClear,
}: {
  tally: TallyEntry[]
  notice: BatchNotice | null
  onChange: (itemId: string, quantity: number) => void
  onClear: () => void
}) {
  const units = tally.reduce((sum, e) => sum + e.quantity, 0)
  return (
    <div className="space-y-2" data-testid="scan-batch-list">
      {notice && (
        <p
          role="status"
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            notice.tone === "success" && "bg-success/12 text-success",
            notice.tone === "info" && "bg-info/12 text-info",
            notice.tone === "error" && "bg-destructive/10 text-destructive"
          )}
        >
          {notice.text}
        </p>
      )}
      {tally.length === 0 ? (
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          Scanned items will collect here. Scan a location label to choose where they go.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {tally.length} item{tally.length === 1 ? "" : "s"} ·{" "}
              <span className="tabular-nums">{formatNumber(units)}</span> unit{units === 1 ? "" : "s"}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
              <Trash2 /> Clear
            </Button>
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {tally.map((entry) => (
              <li key={entry.item.id} className="flex items-center gap-3 px-3 py-2">
                <ItemThumb itemId={entry.item.id} alt={entry.item.name} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.item.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {entry.item.itemNumber}
                    {entry.item.lotTracking && <span className="font-sans"> · lot-tracked</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10"
                    onClick={() => onChange(entry.item.id, entry.quantity - 1)}
                    aria-label={`One less ${entry.item.name}`}
                  >
                    {entry.quantity <= 1 ? <Trash2 /> : <Minus />}
                  </Button>
                  <span className="w-9 text-center font-semibold tabular-nums">{formatNumber(entry.quantity)}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10"
                    onClick={() => onChange(entry.item.id, entry.quantity + 1)}
                    aria-label={`One more ${entry.item.name}`}
                  >
                    <Plus />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
