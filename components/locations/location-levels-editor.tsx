"use client"

import { ChevronRight, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  MAX_LEVELS,
  MAX_LEVEL_LABEL_LENGTH,
  MAX_LEVEL_VALUE_LENGTH,
  newLevelId,
  type LevelDraft,
  type LevelFieldErrors,
} from "./structure"

const LABEL_EXAMPLES = ["Zone", "Aisle", "Shelf", "Bin", "Level", "Slot", "Row", "Position"]
const VALUE_EXAMPLES = ["A", "01", "03", "B", "2", "1", "1", "1"]

interface LocationLevelsEditorProps {
  /**
   * `template` edits level names only (the workspace structure);
   * `location` edits the value for each level (and names for levels added here).
   */
  mode: "template" | "location"
  levels: LevelDraft[]
  onChange: (levels: LevelDraft[]) => void
  errors?: Record<string, LevelFieldErrors>
  disabled?: boolean
  /** Unique prefix for input ids */
  idPrefix: string
  /** Adds the data-testids used by the e2e tests (location-level-value-N etc.) */
  withTestIds?: boolean
  /** Show the "Add level" button (default true) */
  allowAdd?: boolean
  maxLevels?: number
  /** Focus the first empty input when mounted */
  autoFocus?: boolean
}

/**
 * Shared editor for location structure levels, used by the add/edit location dialogs,
 * the workspace structure dialog and the per-location structure editor.
 */
export function LocationLevelsEditor({
  mode,
  levels,
  onChange,
  errors = {},
  disabled = false,
  idPrefix,
  withTestIds = false,
  allowAdd = true,
  maxLevels = MAX_LEVELS,
  autoFocus = false,
}: LocationLevelsEditorProps) {
  const update = (id: string, patch: Partial<LevelDraft>) =>
    onChange(levels.map((level) => (level.id === id ? { ...level, ...patch } : level)))

  const remove = (id: string) => onChange(levels.filter((level) => level.id !== id))

  const add = () => onChange([...levels, { id: newLevelId(), label: "", value: "", fixed: false }])

  const canRemove = (level: LevelDraft) => !level.fixed && levels.length > 1
  const hasRemovable = levels.some(canRemove)
  const firstEmptyIndex = levels.findIndex((l) => (mode === "template" ? !l.label : !l.value))

  return (
    <div className="space-y-3">
      <ol className="space-y-2" data-testid={withTestIds ? "location-levels-container" : undefined}>
        {levels.map((level, index) => {
          const err = errors[level.id] ?? {}
          const labelId = `${idPrefix}-label-${level.id}`
          const valueId = `${idPrefix}-value-${level.id}`
          const errorId = `${idPrefix}-error-${level.id}`
          const message = err.label ?? err.value
          const focusThis = autoFocus && index === Math.max(0, firstEmptyIndex)

          return (
            <li key={level.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  {index + 1}
                </span>

                {mode === "template" ? (
                  <Input
                    id={labelId}
                    value={level.label}
                    onChange={(e) => update(level.id, { label: e.target.value })}
                    placeholder={LABEL_EXAMPLES[index] ?? "Level name"}
                    aria-label={`Level ${index + 1} name`}
                    aria-invalid={Boolean(err.label) || undefined}
                    aria-describedby={message ? errorId : undefined}
                    maxLength={MAX_LEVEL_LABEL_LENGTH + 10}
                    disabled={disabled}
                    autoComplete="off"
                    autoFocus={focusThis}
                    className="h-10 min-w-0 flex-1"
                  />
                ) : (
                  <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_7rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                    {level.fixed ? (
                      <Label htmlFor={valueId} className="min-w-0 text-sm font-medium" title={level.label}>
                        <span className="truncate">{level.label}</span>
                      </Label>
                    ) : (
                      <Input
                        id={labelId}
                        value={level.label}
                        onChange={(e) => update(level.id, { label: e.target.value })}
                        placeholder={LABEL_EXAMPLES[index] ?? "Level name"}
                        aria-label={`Level ${index + 1} name`}
                        aria-invalid={Boolean(err.label) || undefined}
                        aria-describedby={message ? errorId : undefined}
                        maxLength={MAX_LEVEL_LABEL_LENGTH + 10}
                        disabled={disabled}
                        autoComplete="off"
                        className="h-10"
                        data-testid={withTestIds ? `location-level-label-${index}` : undefined}
                      />
                    )}
                    <Input
                      id={valueId}
                      value={level.value}
                      onChange={(e) => update(level.id, { value: e.target.value })}
                      placeholder={VALUE_EXAMPLES[index] ?? "01"}
                      aria-label={level.fixed ? undefined : `Level ${index + 1} value`}
                      aria-invalid={Boolean(err.value) || undefined}
                      aria-describedby={message ? errorId : undefined}
                      maxLength={MAX_LEVEL_VALUE_LENGTH + 4}
                      disabled={disabled}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      autoFocus={focusThis}
                      className="h-10 font-mono uppercase placeholder:normal-case"
                      data-testid={withTestIds ? `location-level-value-${index}` : undefined}
                    />
                  </div>
                )}

                {canRemove(level) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(level.id)}
                    disabled={disabled}
                    aria-label={`Remove level ${index + 1}`}
                    data-testid={withTestIds ? `remove-location-level-${index}` : undefined}
                  >
                    <X />
                  </Button>
                ) : (
                  hasRemovable && <span aria-hidden className="size-10 shrink-0" />
                )}
              </div>
              {message && (
                <p id={errorId} className="pl-8 text-xs text-destructive">
                  {message}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {allowAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={disabled || levels.length >= maxLevels}
          data-testid={withTestIds ? "add-location-level-button" : undefined}
        >
          <Plus /> Add level
        </Button>
      )}
    </div>
  )
}

/** Live preview of the code a set of level values produces */
export function CodePreview({
  code,
  error,
  previousCode,
  label = "Location code",
  "data-testid": testId,
}: {
  code: string
  error?: string
  previousCode?: string
  label?: string
  "data-testid"?: string
}) {
  const changed = previousCode !== undefined && code && code !== previousCode
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/40 px-3 py-2.5",
        error ? "border-destructive/50" : code && "border-primary/30 bg-primary/5"
      )}
      aria-live="polite"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 break-all font-mono text-lg font-semibold leading-tight",
          code ? "text-foreground" : "text-muted-foreground/60"
        )}
        data-testid={testId}
      >
        {code || "—"}
      </p>
      {changed && !error && (
        <p className="mt-1 text-xs text-muted-foreground">
          Currently <span className="font-mono">{previousCode}</span>
        </p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** "Zone › Aisle › Shelf" chain with an example code */
export function TemplatePreview({ labels }: { labels: string[] }) {
  const clean = labels.map((l) => l.trim()).filter(Boolean)
  if (clean.length === 0) return null
  const example = clean.map((_, i) => VALUE_EXAMPLES[i] ?? "1").join("-")
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">Preview</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {clean.map((label, i) => (
          <span key={`${label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">{label}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Codes will look like <span className="font-mono font-medium text-foreground">{example}</span>
      </p>
    </div>
  )
}
