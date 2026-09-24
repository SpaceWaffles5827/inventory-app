"use client"

import { useSyncExternalStore } from "react"
import { Monitor, Moon, Palette, Sun, type LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { SettingsSection } from "./settings-section"

const OPTIONS: { value: "light" | "dark" | "system"; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", hint: "Bright surfaces", icon: Sun },
  { value: "dark", label: "Dark", hint: "Easier on the eyes at night", icon: Moon },
  { value: "system", label: "System", hint: "Match your device", icon: Monitor },
]

const noopSubscribe = () => () => {}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  // next-themes only knows the theme on the client
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
  const value = mounted ? (theme ?? "system") : undefined

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="Choose how StockFlow looks on this device."
      icon={Palette}
    >
      <RadioGroup
        value={value}
        onValueChange={setTheme}
        aria-label="Theme"
        className="grid-cols-1 gap-3 sm:grid-cols-3"
        data-testid="theme-options"
      >
        {OPTIONS.map(({ value: option, label, hint, icon: Icon }) => (
          <Label
            key={option}
            htmlFor={`theme-${option}`}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal leading-normal transition-colors hover:bg-accent/50",
              value === option && "border-primary/50 bg-primary/5"
            )}
          >
            <RadioGroupItem id={`theme-${option}`} value={option} />
            <Icon className="size-4 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </SettingsSection>
  )
}
