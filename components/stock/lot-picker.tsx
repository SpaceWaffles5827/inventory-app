"use client"

import { useMemo, type Dispatch, type SetStateAction } from "react"
import { Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LotStatusBadge } from "@/components/common/status-badge"
import { formatDate, formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import { OptionList, OptionRow } from "./option-list"
import { daysBetween, lotQuantityAt, sortLotsFefo, testIdSlug, type StockLot } from "./stock-utils"

export const NEW_LOT = "__new_lot__"

export interface NewLotDraft {
  lotNumber: string
  expirationDate: string
}

export const EMPTY_NEW_LOT: NewLotDraft = { lotNumber: "", expirationDate: "" }

/**
 * Lots worth offering at a location. Taking stock out: lots with stock there, first-expired-first-out.
 * Adding: lots already there first, then other usable lots, expired / recalled ones last.
 */
export function lotCandidates(lots: StockLot[], locationId: string | null, onlyWithStock: boolean): StockLot[] {
  if (onlyWithStock) return sortLotsFefo(lots.filter((lot) => lotQuantityAt(lot, locationId) > 0))
  const rank = (lot: StockLot) => {
    if (lot.status === "EXPIRED" || lot.status === "RECALLED") return 2
    return lotQuantityAt(lot, locationId) > 0 ? 0 : 1
  }
  return sortLotsFefo(lots.filter((lot) => lotQuantityAt(lot, locationId) > 0 || lot.status !== "DEPLETED")).sort(
    (a, b) => rank(a) - rank(b)
  )
}

interface LotPickerProps {
  lots: StockLot[]
  locationId: string | null
  value: string | null
  onChange: (id: string) => void
  onConfirm?: (id: string) => void
  unit?: string | null
  testIdPrefix: string
  /** Only lots that have stock at this location (stock out / transfer) */
  onlyWithStock?: boolean
  /** Offer "New lot" (stock in) */
  allowCreate?: boolean
  newLot?: NewLotDraft
  onNewLotChange?: Dispatch<SetStateAction<NewLotDraft>>
  newLotTestId?: string
  /** Reference time for expiry warnings */
  now: number
  emptyMessage?: string
}

function ExpiryText({ date, now }: { date: string | Date | null; now: number }) {
  const days = daysBetween(now, date)
  if (days === null) return <span>No expiry</span>
  if (days < 0) return <span className="font-medium text-destructive">Expired {formatDate(date)}</span>
  if (days <= 30) {
    return (
      <span className="rounded bg-warning/15 px-1 font-medium text-warning-foreground dark:text-warning">
        Expires {days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}
      </span>
    )
  }
  return <span>Expires {formatDate(date)}</span>
}

/** Pick a lot (sorted first-expired-first-out) with its quantity at the chosen location */
export function LotPicker({
  lots,
  locationId,
  value,
  onChange,
  onConfirm,
  unit,
  testIdPrefix,
  onlyWithStock = false,
  allowCreate = false,
  newLot = EMPTY_NEW_LOT,
  onNewLotChange,
  newLotTestId,
  now,
  emptyMessage = "No lots have stock here.",
}: LotPickerProps) {
  const candidates = useMemo(() => lotCandidates(lots, locationId, onlyWithStock), [lots, locationId, onlyWithStock])
  const hasSelection = !!value && (value === NEW_LOT || candidates.some((l) => l.id === value))
  const creating = value === NEW_LOT

  return (
    <div className="space-y-3">
      {candidates.length === 0 && !allowCreate && (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}

      <OptionList label="Lot">
        {candidates.map((lot, index) => {
          const here = lotQuantityAt(lot, locationId)
          return (
            <OptionRow
              key={lot.id}
              selected={lot.id === value}
              onSelect={() => onChange(lot.id)}
              onConfirm={onConfirm ? () => onConfirm(lot.id) : undefined}
              tabbable={hasSelection ? lot.id === value : index === 0}
              title={lot.lotNumber}
              subtitle={
                <>
                  <ExpiryText date={lot.expirationDate} now={now} />
                  {here === 0 && <span> · not here yet</span>}
                </>
              }
              trailing={
                <span className="flex flex-col items-end gap-1">
                  <span className={cn("font-semibold tabular-nums", here === 0 && "text-muted-foreground")}>
                    {formatQuantity(here, unit)}
                  </span>
                  {lot.status && lot.status !== "ACTIVE" && <LotStatusBadge status={lot.status} />}
                </span>
              }
              data-testid={`${testIdPrefix}-${testIdSlug(lot.lotNumber)}`}
            />
          )
        })}

        {allowCreate && (
          <OptionRow
            selected={creating}
            onSelect={() => onChange(NEW_LOT)}
            tabbable={hasSelection ? creating : candidates.length === 0}
            titleClassName="font-sans"
            title="New lot"
            subtitle="Receive a new batch with its own lot number"
            leading={
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plus className="size-4" />
              </span>
            }
            data-testid={newLotTestId}
          />
        )}
      </OptionList>

      {creating && onNewLotChange && (
        <div className="grid gap-3 rounded-xl border bg-muted/40 p-3.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-lot-number">Lot number</Label>
            <Input
              id="new-lot-number"
              value={newLot.lotNumber}
              onChange={(e) => {
                const lotNumber = e.target.value
                onNewLotChange((prev) => ({ ...prev, lotNumber }))
              }}
              placeholder="e.g. LOT-2026-014"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-11 font-mono"
              required
              data-testid="new-lot-number-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-lot-expiry">
              Expiry date <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="new-lot-expiry"
              type="date"
              value={newLot.expirationDate}
              onChange={(e) => {
                const expirationDate = e.target.value
                onNewLotChange((prev) => ({ ...prev, expirationDate }))
              }}
              className="h-11"
              data-testid="new-lot-expiry-input"
            />
          </div>
        </div>
      )}
    </div>
  )
}
