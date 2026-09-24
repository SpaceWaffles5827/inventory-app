"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string
  onValueChange: (value: string) => void
}

export function SearchInput({ value, onValueChange, className, placeholder = "Search…", ...props }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
