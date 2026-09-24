"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Small icon button that copies `value` to the clipboard */
export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`Copied ${value}`)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  )
}
