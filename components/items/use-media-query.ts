"use client"

import { useCallback, useSyncExternalStore } from "react"

/** Reactive `window.matchMedia(query).matches`. Dashboard pages only render client-side, so the server value is just a fallback. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
  )
}

/** Tailwind `md` breakpoint (768px) — below it lists replace tables */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)", true)
}
