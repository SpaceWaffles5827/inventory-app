// Helpers for location structures ("Zone → Aisle → Shelf") and the codes built from them.
// A workspace stores a template (level names only); each location stores `{ label, value }[]`
// and its code is the level values joined with "-" (e.g. "A-01-03").

import type { LocationStructure, LocationTemplate } from "@/lib/api/locations.api"

export type StructurePart = LocationStructure[number]

export const CODE_SEPARATOR = "-"
export const MAX_LEVELS = 8
export const MAX_LEVEL_LABEL_LENGTH = 30
export const MAX_LEVEL_VALUE_LENGTH = 16
export const MAX_CODE_LENGTH = 64
export const DEFAULT_LEVEL_LABELS = ["Zone", "Aisle"]

/** One editable row in a structure editor */
export interface LevelDraft {
  id: string
  label: string
  value: string
  /** Label comes from the workspace/location structure and can't be renamed or removed here */
  fixed: boolean
}

export interface LevelFieldErrors {
  label?: string
  value?: string
}

export interface LevelValidation {
  byId: Record<string, LevelFieldErrors>
  /** Error that isn't tied to a single row */
  form?: string
  valid: boolean
}

let levelSeq = 0
export function newLevelId(): string {
  levelSeq += 1
  return `level-${levelSeq}`
}

// ---------------------------------------------------------------------------
// Parsing (structure is stored as JSON, so never trust its shape)
// ---------------------------------------------------------------------------

export function parseLocationStructure(value: unknown): LocationStructure {
  if (!Array.isArray(value)) return []
  const parts: LocationStructure = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const { label, value: raw } = entry as Record<string, unknown>
    if (typeof raw !== "string" && typeof raw !== "number") continue
    const text = String(raw).trim()
    if (!text) continue
    parts.push({ label: typeof label === "string" ? label.trim() : "", value: text })
  }
  return parts
}

export function parseLocationTemplate(value: unknown): LocationTemplate | null {
  if (!value || typeof value !== "object") return null
  const levels = (value as { levels?: unknown }).levels
  if (!Array.isArray(levels)) return null
  const labels = levels
    .map((level) =>
      level && typeof level === "object" && typeof (level as { label?: unknown }).label === "string"
        ? (level as { label: string }).label.trim()
        : ""
    )
    .filter(Boolean)
  return labels.length > 0 ? { levels: labels.map((label) => ({ label })) } : null
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

export function normalizeLevelValue(value: string): string {
  return value.trim().toUpperCase()
}

/** Joins the non-empty level values: ["a", "01", ""] → "A-01" */
export function composeLocationCode(values: string[]): string {
  return values.map(normalizeLevelValue).filter(Boolean).join(CODE_SEPARATOR)
}

/** Next value in a sequence, keeping zero padding: "03" → "04", "A9" → "A10", "B" → "C" */
export function incrementLevelValue(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(.*?)(\d+)$/)
  if (match) {
    const [, prefix, digits] = match
    const next = String(Number(digits) + 1).padStart(digits.length, "0")
    return `${prefix}${next}`
  }
  const last = trimmed.slice(-1)
  if (/^[A-Ya-y]$/.test(last)) return trimmed.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1)
  return trimmed
}

/** Barcodes the server generates look like `LOC-<code>` (or `LOC-<code>#2` when taken) */
export function isGeneratedBarcode(barcode: string | null | undefined, code: string): boolean {
  if (!barcode) return false
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^LOC-${escaped}(#\\d+)?$`).test(barcode)
}

/**
 * Barcode to send when a location's code changes. `undefined` means "omit it", which makes the
 * server regenerate a barcode from the new code. Custom barcodes are kept so printed labels stay valid.
 */
export function barcodeForCodeChange(
  currentBarcode: string | null | undefined,
  currentCode: string,
  nextCode: string
): string | undefined {
  if (!currentBarcode) return undefined
  if (nextCode !== currentCode && isGeneratedBarcode(currentBarcode, currentCode)) return undefined
  return currentBarcode
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export function draftsFromTemplate(template: LocationTemplate | null): LevelDraft[] {
  const labels = template?.levels.map((l) => l.label.trim()).filter(Boolean) ?? []
  const source = labels.length > 0 ? labels : DEFAULT_LEVEL_LABELS
  return source.map((label) => ({ id: newLevelId(), label, value: "", fixed: true }))
}

export function draftsFromStructure(structure: LocationStructure, fixed: boolean): LevelDraft[] {
  return structure.map((part, index) => ({
    id: newLevelId(),
    label: part.label || `Level ${index + 1}`,
    value: part.value,
    fixed,
  }))
}

export function structureFromDrafts(levels: LevelDraft[]): LocationStructure {
  return levels
    .filter((level) => level.value.trim())
    .map((level, index) => ({
      label: level.label.trim() || `Level ${index + 1}`,
      value: normalizeLevelValue(level.value),
    }))
}

export function templateFromDrafts(levels: LevelDraft[]): LocationTemplate {
  return { levels: levels.map((l) => l.label.trim()).filter(Boolean).map((label) => ({ label })) }
}

export function sameLabels(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((label, i) => label.trim().toLowerCase() === b[i].trim().toLowerCase())
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function duplicateLabelIds(levels: LevelDraft[]): Set<string> {
  const seen = new Map<string, string>()
  const dupes = new Set<string>()
  for (const level of levels) {
    const key = level.label.trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) dupes.add(level.id)
    else seen.set(key, level.id)
  }
  return dupes
}

/** Validates level values for a location code (add/edit/structure editor) */
export function validateLocationLevels(levels: LevelDraft[]): LevelValidation {
  const byId: Record<string, LevelFieldErrors> = {}
  const set = (id: string, field: keyof LevelFieldErrors, message: string) => {
    byId[id] = { ...byId[id], [field]: message }
  }

  const lastFilled = levels.reduce((acc, level, i) => (level.value.trim() ? i : acc), -1)
  const dupes = duplicateLabelIds(levels)

  levels.forEach((level, i) => {
    const value = level.value.trim()
    const label = level.label.trim()
    if (value && /\s/.test(value)) set(level.id, "value", "No spaces")
    else if (value.length > MAX_LEVEL_VALUE_LENGTH) set(level.id, "value", `Max ${MAX_LEVEL_VALUE_LENGTH} characters`)
    else if (!value && i < lastFilled) set(level.id, "value", "Required — a later level is filled in")

    if (!level.fixed && value && !label) set(level.id, "label", "Name this level")
    else if (label.length > MAX_LEVEL_LABEL_LENGTH) set(level.id, "label", `Max ${MAX_LEVEL_LABEL_LENGTH} characters`)
    else if (dupes.has(level.id) && value) set(level.id, "label", "Level names must be unique")
  })

  let form: string | undefined
  if (lastFilled < 0) form = "Enter a value for at least the first level"
  else if (composeLocationCode(levels.map((l) => l.value)).length > MAX_CODE_LENGTH)
    form = `Codes can be at most ${MAX_CODE_LENGTH} characters`

  return { byId, form, valid: !form && Object.keys(byId).length === 0 }
}

/** Validates level names for the workspace template */
export function validateTemplateLevels(levels: LevelDraft[]): LevelValidation {
  const byId: Record<string, LevelFieldErrors> = {}
  const dupes = duplicateLabelIds(levels)
  for (const level of levels) {
    const label = level.label.trim()
    if (label.length > MAX_LEVEL_LABEL_LENGTH) byId[level.id] = { label: `Max ${MAX_LEVEL_LABEL_LENGTH} characters` }
    else if (dupes.has(level.id)) byId[level.id] = { label: "Level names must be unique" }
  }
  const form = levels.some((l) => l.label.trim()) ? undefined : "Add at least one level"
  return { byId, form, valid: !form && Object.keys(byId).length === 0 }
}

/** Shared validation for the optional capacity field. Returns the parsed value or an error. */
export function parseCapacity(input: string): { value?: number; error?: string } {
  const trimmed = input.trim()
  if (!trimmed) return {}
  if (!/^\d+$/.test(trimmed)) return { error: "Enter a whole number" }
  const n = Number(trimmed)
  if (n < 1) return { error: "Must be at least 1" }
  if (n > 1_000_000) return { error: "That's too large" }
  return { value: n }
}

export function validateBarcode(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  if (/\s/.test(trimmed)) return "No spaces"
  if (trimmed.length > 64) return "Max 64 characters"
  // CODE128 (used on labels) only encodes ASCII
  if (!/^[\x21-\x7E]+$/.test(trimmed)) return "Use plain letters, numbers and symbols"
  return undefined
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** "Zone A · Aisle 01" */
export function formatStructurePath(structure: LocationStructure): string {
  return structure.map((part) => (part.label ? `${part.label} ${part.value}` : part.value)).join(" · ")
}

/** Natural sort for codes so A-2 comes before A-10 */
export function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}
