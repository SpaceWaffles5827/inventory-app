"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChevronDown, MapPin } from "lucide-react"
import { SearchInput } from "@/components/common/search-input"
import { formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import { OptionList, OptionRow } from "./option-list"
import { testIdSlug, type LocationOption } from "./stock-utils"

const RENDER_LIMIT = 100

interface LocationPickerProps {
  options: LocationOption[]
  value: string | null
  onChange: (id: string) => void
  /** Enter / double-click on an option: select it and advance */
  onConfirm?: (id: string) => void
  unit?: string | null
  /** Accessible name of the radio group */
  label: string
  /** data-testid for each option: `${prefix}-${slug(code)}` */
  testIdPrefix: string
  /**
   * List the item's own locations (assigned or holding stock) first and tuck every other
   * location behind a searchable "other locations" panel.
   */
  splitOthers?: boolean
  otherButtonLabel?: string
  otherButtonTestId?: string
  searchTestId?: string
  /** Rendered at the bottom of the "other locations" panel (e.g. a "New location" button) */
  othersFooter?: ReactNode
  /** Show a search box once there are more options than this */
  searchThreshold?: number
  /** Shown when there are no options at all */
  emptyState?: ReactNode
}

function matches(option: LocationOption, query: string) {
  if (!query) return true
  const q = query.trim().toLowerCase()
  return option.code.toLowerCase().includes(q) || (option.description ?? "").toLowerCase().includes(q)
}

/** Pick a location, showing how much of the item is already there */
export function LocationPicker({
  options,
  value,
  onChange,
  onConfirm,
  unit,
  label,
  testIdPrefix,
  splitOthers = false,
  otherButtonLabel = "Other locations",
  otherButtonTestId,
  searchTestId,
  othersFooter,
  searchThreshold = 7,
  emptyState,
}: LocationPickerProps) {
  const [query, setQuery] = useState("")

  const { primary, others } = useMemo(() => {
    if (!splitOthers) return { primary: options, others: [] as LocationOption[] }
    const mine = options
      .filter((o) => o.assigned || o.onHand > 0)
      .sort((a, b) => b.onHand - a.onHand || a.code.localeCompare(b.code))
    const rest = options.filter((o) => !(o.assigned || o.onHand > 0))
    return { primary: mine, others: rest }
  }, [options, splitOthers])

  // With nothing "primary", the other locations are the only choice — show them straight away.
  const othersOnly = splitOthers && primary.length === 0
  const [othersOpen, setOthersOpen] = useState(() => !!value && others.some((o) => o.id === value))
  const showOthers = splitOthers && (othersOnly || othersOpen) && others.length > 0

  if (options.length === 0) return <>{emptyState}</>

  const hasSelection = !!value && options.some((o) => o.id === value)

  const renderRow = (option: LocationOption, index: number) => (
    <OptionRow
      key={option.id}
      selected={option.id === value}
      onSelect={() => onChange(option.id)}
      onConfirm={onConfirm ? () => onConfirm(option.id) : undefined}
      tabbable={hasSelection ? option.id === value : index === 0}
      title={option.code}
      subtitle={option.description || undefined}
      trailing={
        option.onHand > 0 ? (
          <span className="font-semibold tabular-nums">{formatQuantity(option.onHand, unit)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Empty</span>
        )
      }
      data-testid={`${testIdPrefix}-${testIdSlug(option.code)}`}
    />
  )

  // Simple mode: one list, with search once it gets long.
  if (!splitOthers) {
    const filtered = options.filter((o) => matches(o, query))
    return (
      <div className="space-y-3">
        {options.length > searchThreshold && (
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search locations…"
            aria-label="Search locations"
            data-testid={searchTestId}
          />
        )}
        <OptionList label={label}>
          {filtered.slice(0, RENDER_LIMIT).map(renderRow)}
        </OptionList>
        <SearchFooter total={filtered.length} query={query} />
      </div>
    )
  }

  const filteredOthers = others.filter((o) => matches(o, query))

  return (
    <div className="space-y-3">
      {primary.length > 0 && (
        <OptionList label={label}>{primary.map(renderRow)}</OptionList>
      )}

      {others.length > 0 && !othersOnly && (
        <button
          type="button"
          onClick={() => setOthersOpen((open) => !open)}
          aria-expanded={othersOpen}
          data-testid={otherButtonTestId}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed px-3.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors",
            "hover:border-primary/40 hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            othersOpen && "border-solid text-foreground"
          )}
        >
          <MapPin className="size-4" />
          <span className="flex-1">{otherButtonLabel}</span>
          <span className="text-xs tabular-nums">{others.length}</span>
          <ChevronDown className={cn("size-4 transition-transform", othersOpen && "rotate-180")} />
        </button>
      )}

      {showOthers && (
        <div className="space-y-3">
          {(others.length > searchThreshold || !othersOnly) && (
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search locations…"
              aria-label="Search other locations"
              data-testid={searchTestId}
            />
          )}
          <OptionList label={`${label} (other locations)`}>
            {filteredOthers.slice(0, RENDER_LIMIT).map((o, i) => renderRow(o, primary.length + i))}
          </OptionList>
          <SearchFooter total={filteredOthers.length} query={query} />
        </div>
      )}

      {(showOthers || others.length === 0) && othersFooter}
    </div>
  )
}

function SearchFooter({ total, query }: { total: number; query: string }) {
  if (total === 0) {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        {query ? `No locations match “${query}”` : "No locations"}
      </p>
    )
  }
  if (total > RENDER_LIMIT) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Showing {RENDER_LIMIT} of {total} — keep typing to narrow down
      </p>
    )
  }
  return null
}
