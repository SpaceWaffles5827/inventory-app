"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface Option<T extends string> {
  value: T
  label: string
}

/** Small labelled select used for filters and sort order in list toolbars */
export function OptionSelect<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  "data-testid": testId,
}: {
  value: T
  onValueChange: (value: T) => void
  options: Option<T>[]
  /** Accessible name, e.g. "Sort by" */
  label: string
  className?: string
  "data-testid"?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as T)}>
      <SelectTrigger aria-label={label} className={cn("w-full sm:w-44", className)} data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Search on top (full width) with filters below on phones; one row from `sm` up */
export function ListToolbar({
  search,
  children,
  className,
}: {
  search: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3", className)}>
      <div className="min-w-0 flex-1 sm:max-w-sm">{search}</div>
      {children && <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:gap-3">{children}</div>}
    </div>
  )
}
