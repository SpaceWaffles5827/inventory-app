"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateWorkspaceStructureApi, type LocationTemplate } from "@/lib/api/locations.api"
import { getErrorMessage } from "@/lib/api/client"
import { LocationLevelsEditor, TemplatePreview } from "@/components/locations/location-levels-editor"
import {
  DEFAULT_LEVEL_LABELS,
  newLevelId,
  templateFromDrafts,
  validateTemplateLevels,
  type LevelDraft,
} from "@/components/locations/structure"

interface ConfigureStructureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  defaultStructure: LocationTemplate | null
  onSuccess: (structure: LocationTemplate) => void
}

/** Admin dialog for the workspace's location structure (the level names new codes are built from) */
export function ConfigureStructureDialog({ open, onOpenChange, ...rest }: ConfigureStructureDialogProps) {
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" data-testid="configure-structure-dialog">
        <DialogHeader>
          <DialogTitle>Location structure</DialogTitle>
          <DialogDescription>
            Name the levels your storage is organised by, from largest to smallest. New location codes are built
            from one value per level.
          </DialogDescription>
        </DialogHeader>
        <TemplateForm onOpenChange={onOpenChange} saving={saving} setSaving={setSaving} {...rest} />
      </DialogContent>
    </Dialog>
  )
}

function TemplateForm({
  workspaceId,
  defaultStructure,
  onSuccess,
  onOpenChange,
  saving,
  setSaving,
}: Omit<ConfigureStructureDialogProps, "open"> & { saving: boolean; setSaving: (saving: boolean) => void }) {
  const [levels, setLevels] = useState<LevelDraft[]>(() => {
    const labels = defaultStructure?.levels.map((l) => l.label) ?? DEFAULT_LEVEL_LABELS
    return labels.map((label) => ({ id: newLevelId(), label, value: "", fixed: false }))
  })
  const [submitted, setSubmitted] = useState(false)
  const check = validateTemplateLevels(levels)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!check.valid) return

    const structure = templateFromDrafts(levels)
    setSaving(true)
    try {
      await updateWorkspaceStructureApi({ workspaceId, structure })
      onSuccess(structure)
      toast.success("Location structure saved", { description: structure.levels.map((l) => l.label).join(" › ") })
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save the location structure"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <LocationLevelsEditor
        mode="template"
        idPrefix="workspace-structure"
        levels={levels}
        onChange={setLevels}
        errors={check.byId}
        disabled={saving}
      />
      {submitted && check.form && <p className="text-xs text-destructive">{check.form}</p>}

      <TemplatePreview labels={levels.map((l) => l.label)} />

      <p className="text-xs text-muted-foreground">
        Existing locations keep their current codes. Empty levels are ignored.
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="save-structure-button">
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save structure"}
        </Button>
      </DialogFooter>
    </form>
  )
}
