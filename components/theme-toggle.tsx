"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const subscribe = () => () => {}

/** True once hydrated on the client — the theme is unknown during SSR. */
function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}

/** Icon button that flips between light and dark (resolves "system" to what's actually showing). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const isDark = mounted && resolvedTheme === "dark"
  const label = isDark ? "Switch to light theme" : "Switch to dark theme"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label={label}
      title={mounted ? label : undefined}
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
}
