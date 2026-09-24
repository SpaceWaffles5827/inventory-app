"use client"

import { useState } from "react"
import { Keyboard, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ManualCodeEntryProps {
  onSubmit: (code: string) => void
  placeholder?: string
  submitLabel?: string
  autoFocus?: boolean
  busy?: boolean
  /** Clear the field after submitting (default true) */
  clearOnSubmit?: boolean
  inputTestId?: string
  submitTestId?: string
  className?: string
}

/**
 * Type a code, or let a USB/Bluetooth handheld scanner "type" it followed by Enter.
 * Also the fallback whenever the camera isn't available.
 */
export function ManualCodeEntry({
  onSubmit,
  placeholder = "Type or scan a code",
  submitLabel = "Look up",
  autoFocus,
  busy,
  clearOnSubmit = true,
  inputTestId = "scanner-manual-input",
  submitTestId = "scanner-manual-submit",
  className,
}: ManualCodeEntryProps) {
  const [value, setValue] = useState("")
  const code = value.trim()

  return (
    <form
      className={cn("flex gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!code || busy) return
        onSubmit(code)
        if (clearOnSubmit) setValue("")
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Barcode or code"
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-11 pl-9 font-mono"
          data-testid={inputTestId}
        />
      </div>
      <Button type="submit" className="h-11 shrink-0" disabled={!code || busy} data-testid={submitTestId}>
        {busy ? <Loader2 className="animate-spin" /> : <Search />}
        <span className="hidden sm:inline">{submitLabel}</span>
        <span className="sr-only sm:hidden">{submitLabel}</span>
      </Button>
    </form>
  )
}
