"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CodePreview, LocationLevelsEditor } from "@/components/locations/location-levels-editor"
import {
  composeLocationCode,
  draftsFromStructure,
  newLevelId,
  structureFromDrafts,
  validateLocationLevels,
  type LevelDraft,
  type StructurePart,
} from "@/components/locations/structure"

interface StructureEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The location's current levels */
  initialStructure: StructurePart[]
  /** Persist the new levels. Throw to keep the dialog open (the caller shows the error). */
  onSave: (structure: StructurePart[]) => Promise<void>
  /** Current code, shown next to the preview when it changes */
  currentCode?: string
}

/** Edits one location's levels (names and values); the code is rebuilt from the values */
export function StructureEditorDialog({ open, onOpenChange, ...rest }: StructureEditorDialogProps) {
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" data-testid="structure-editor-dialog">
        <DialogHeader>
          <DialogTitle>Edit location levels</DialogTitle>
          <DialogDescription>
            Rename, add or remove this location&apos;s levels. Its code is rebuilt from the values.
          </DialogDescription>
        </DialogHeader>
        <LevelsForm onOpenChange={onOpenChange} saving={saving} setSaving={setSaving} {...rest} />
      </DialogContent>
    </Dialog>
  )
}

function LevelsForm({
  initialStructure,
  onSave,
  currentCode,
  onOpenChange,
  saving,
  setSaving,
}: Omit<StructureEditorDialogProps, "open"> & { saving: boolean; setSaving: (saving: boolean) => void }) {
  const [levels, setLevels] = useState<LevelDraft[]>(() =>
    initialStructure.length > 0
      ? draftsFromStructure(initialStructure, false)
      : [{ id: newLevelId(), label: "Zone", value: "", fixed: false }]
  )
  const [submitted, setSubmitted] = useState(false)

  const check = validateLocationLevels(levels)
  const code = composeLocationCode(levels.map((l) => l.value))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!check.valid) return
    setSaving(true)
    try {
      await onSave(structureFromDrafts(levels))
      onOpenChange(false)
    } catch {
      // The caller already showed a toast; keep the dialog open so nothing is lost
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <LocationLevelsEditor
        mode="location"
        idPrefix="structure-editor"
        levels={levels}
        onChange={setLevels}
        errors={submitted ? check.byId : undefined}
        disabled={saving}
        autoFocus
      />
      <CodePreview code={code} previousCode={currentCode} error={submitted ? check.form : undefined} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="save-location-levels-button">
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save levels"}
        </Button>
      </DialogFooter>
    </form>
  )
}
