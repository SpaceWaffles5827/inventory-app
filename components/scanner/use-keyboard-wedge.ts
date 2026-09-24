"use client"

import { useEffect, useEffectEvent } from "react"

interface UseKeyboardWedgeOptions {
  enabled: boolean
  onScan: (code: string) => void
  /** Shortest code accepted */
  minLength?: number
  /** Max gap between keystrokes; handheld scanners "type" much faster than people */
  maxGapMs?: number
}

/**
 * Catches codes from USB/Bluetooth handheld scanners (which act as keyboards) when no text
 * field has focus: a fast burst of characters ending in Enter. Typing into inputs is left alone.
 */
export function useKeyboardWedge({ enabled, onScan, minLength = 4, maxGapMs = 50 }: UseKeyboardWedgeOptions) {
  const emit = useEffectEvent((code: string) => onScan(code))

  useEffect(() => {
    if (!enabled) return
    let buffer = ""
    let last = 0

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
      ) {
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const now = e.timeStamp || performance.now()
      if (now - last > maxGapMs) buffer = ""
      last = now

      if (e.key === "Enter" || e.key === "Tab") {
        if (buffer.length >= minLength) {
          e.preventDefault()
          e.stopPropagation()
          emit(buffer)
        }
        buffer = ""
        return
      }
      if (e.key.length === 1) buffer += e.key
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [enabled, minLength, maxGapMs])
}
