"use client"

import { useRef, useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createLocationApi,
  updateWorkspaceStructureApi,
  type LocationTemplate,
  type LocationWithCount,
} from "@/lib/api/locations.api"
import { ApiError, getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { BarcodeField } from "@/components/locations/barcode-field"
import { CodePreview, LocationLevelsEditor } from "@/components/locations/location-levels-editor"
import { useLocationCodes } from "@/components/locations/use-location-codes"
import { toLocationWithCount } from "@/components/locations/types"
import {
  composeLocationCode,
  draftsFromTemplate,
  incrementLevelValue,
  parseCapacity,
  sameLabels,
  structureFromDrafts,
  templateFromDrafts,
  validateBarcode,
  validateLocationLevels,
  validateTemplateLevels,
  type LevelDraft,
} from "@/components/locations/structure"

export interface AddLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  /** Workspace location structure; level names become the code's inputs */
  defaultStructure: LocationTemplate | null
  onSuccess: (location: LocationWithCount) => void
  /** Called after an admin saves the dialog's levels as the workspace structure */
  onStructureUpdate?: (structure: LocationTemplate) => void
  /** Existing codes for instant duplicate checks; fetched in the background when omitted */
  existingCodes?: string[]
  /** Show the "add another" option that keeps the dialog open with the next code prefilled */
  allowAddAnother?: boolean
}

export function AddLocationDialog(props: AddLocationDialogProps) {
  const { open, onOpenChange } = props
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" data-testid="add-location-dialog">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">Add location</DialogTitle>
          <DialogDescription>
            Fill in each level to build the location&apos;s code. Everything else is optional.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every open starts with a fresh form */}
        <AddLocationForm {...props} saving={saving} setSaving={setSaving} />
      </DialogContent>
    </Dialog>
  )
}

function AddLocationForm({
  onOpenChange,
  workspaceId,
  defaultStructure,
  onSuccess,
  onStructureUpdate,
  existingCodes,
  allowAddAnother = false,
  saving,
  setSaving,
}: AddLocationDialogProps & { saving: boolean; setSaving: (saving: boolean) => void }) {
  const { isAdmin } = useWorkspace()
  const formRef = useRef<HTMLFormElement>(null)

  const [levels, setLevels] = useState<LevelDraft[]>(() => draftsFromTemplate(defaultStructure))
  const [touched, setTouched] = useState(false)
  const [seenTemplate, setSeenTemplate] = useState(defaultStructure)
  const [description, setDescription] = useState("")
  const [barcode, setBarcode] = useState("")
  const [capacity, setCapacity] = useState("")
  const [addAnother, setAddAnother] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<{ field: "code" | "barcode"; key: string; message: string } | null>(
    null
  )
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [created, setCreated] = useState<string[]>([])

  // The workspace structure may arrive after the dialog opened; adopt it until the user starts typing.
  if (defaultStructure !== seenTemplate) {
    setSeenTemplate(defaultStructure)
    if (!touched) setLevels(draftsFromTemplate(defaultStructure))
  }

  const knownCodes = useLocationCodes(workspaceId, existingCodes)

  const code = composeLocationCode(levels.map((l) => l.value))
  const levelCheck = validateLocationLevels(levels)
  const isDuplicate = Boolean(code) && (knownCodes?.has(code) || created.includes(code))
  const codeError =
    (serverError?.field === "code" && serverError.key === code ? serverError.message : undefined) ??
    (isDuplicate ? `A location with code ${code} already exists` : undefined) ??
    (submitted ? levelCheck.form : undefined)

  const capacityCheck = parseCapacity(capacity)
  const barcodeError =
    (serverError?.field === "barcode" && serverError.key === barcode.trim() ? serverError.message : undefined) ??
    validateBarcode(barcode)

  const templateLabels = defaultStructure?.levels.map((l) => l.label) ?? []
  const levelLabels = levels.map((l) => l.label.trim())
  const labelsDiffer = !sameLabels(levelLabels, templateLabels)

  const changeLevels = (next: LevelDraft[]) => {
    setLevels(next)
    setTouched(true)
  }

  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
  }

  const saveLevelsAsStructure = async () => {
    const check = validateTemplateLevels(levels)
    if (!check.valid || levels.some((l) => !l.label.trim())) {
      toast.error("Give every level a unique name before saving it as the structure")
      return
    }
    const template = templateFromDrafts(levels)
    setSavingTemplate(true)
    try {
      await updateWorkspaceStructureApi({ workspaceId, structure: template })
      onStructureUpdate?.(template)
      setSeenTemplate(template)
      setLevels((prev) => prev.map((l) => ({ ...l, label: l.label.trim(), fixed: true })))
      toast.success("Saved as the workspace location structure", {
        description: template.levels.map((l) => l.label).join(" › "),
      })
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save the location structure"))
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!levelCheck.valid || isDuplicate || capacityCheck.error || barcodeError) {
      focusFirstInvalid()
      return
    }

    setSaving(true)
    try {
      const res = await createLocationApi({
        code,
        structure: structureFromDrafts(levels),
        barcode: barcode.trim() || undefined,
        capacity: capacityCheck.value,
        description: description.trim() || undefined,
        workspaceId,
      })
      const location = res.data?.location
      if (!location) throw new Error("The server didn't return the new location")

      onSuccess(toLocationWithCount(location))
      toast.success(`Location ${code} created`)
      setCreated((prev) => [...prev, code])

      if (allowAddAnother && addAnother) {
        // Prefill the next code in the sequence (A-01-03 → A-01-04)
        const lastFilled = levels.reduce((acc, level, i) => (level.value.trim() ? i : acc), -1)
        setLevels((prev) =>
          prev.map((level, i) => (i === lastFilled ? { ...level, value: incrementLevelValue(level.value) } : level))
        )
        setBarcode("")
        setSubmitted(false)
        setServerError(null)
      } else {
        onOpenChange(false)
      }
    } catch (err) {
      const message = getErrorMessage(err, "Couldn't create the location")
      const conflict = err instanceof ApiError && err.status === 409
      if (/barcode/i.test(message)) {
        setServerError({ field: "barcode", key: barcode.trim(), message })
        focusFirstInvalid()
      } else if (conflict || (/code/i.test(message) && /exist/i.test(message))) {
        setServerError({ field: "code", key: code, message })
      } else {
        toast.error(message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      <section className="space-y-3" aria-labelledby="add-location-code-heading">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="add-location-code-heading" className="text-sm font-medium">
            Code
          </h3>
          {defaultStructure && (
            <span className="truncate text-xs text-muted-foreground">
              {defaultStructure.levels.map((l) => l.label).join(" › ")}
            </span>
          )}
        </div>

        <LocationLevelsEditor
          mode="location"
          idPrefix="add-location"
          levels={levels}
          onChange={changeLevels}
          errors={submitted ? levelCheck.byId : undefined}
          disabled={saving}
          withTestIds
          autoFocus
        />

        <CodePreview code={code} error={codeError} data-testid="generated-location-code" />

        {labelsDiffer &&
          (isAdmin ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {defaultStructure
                  ? "These levels differ from your workspace structure."
                  : "No location structure yet. Save these levels so every new location uses them."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={saveLevelsAsStructure}
                disabled={saving || savingTemplate}
                data-testid="save-default-structure-button"
              >
                {savingTemplate && <Loader2 className="animate-spin" />}
                Save as structure
              </Button>
            </div>
          ) : (
            !defaultStructure && (
              <p className="text-xs text-muted-foreground">
                Codes use Zone and Aisle until an admin sets up your location structure.
              </p>
            )
          ))}
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="add-location-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="add-location-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Cold storage, top shelf — forklift access only"
          rows={2}
          maxLength={191}
          disabled={saving}
          className="min-h-16 resize-none"
          data-testid="location-description-input"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BarcodeField
          id="add-location-barcode"
          value={barcode}
          onChange={setBarcode}
          error={barcodeError}
          hint={code ? `Leave blank to use LOC-${code}` : "Leave blank to generate one"}
          disabled={saving}
          data-testid="location-barcode-input"
        />
        <div className="space-y-1.5">
          <Label htmlFor="add-location-capacity">
            Capacity <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="add-location-capacity"
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="100"
            aria-invalid={Boolean(capacityCheck.error) || undefined}
            aria-describedby="add-location-capacity-help"
            disabled={saving}
            className="h-10 tabular-nums"
            data-testid="location-capacity-input"
          />
          <p
            id="add-location-capacity-help"
            className={capacityCheck.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
          >
            {capacityCheck.error ?? "Max units this location holds"}
          </p>
        </div>
      </div>

      {allowAddAnother && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="add-location-another"
            checked={addAnother}
            onCheckedChange={(checked) => setAddAnother(checked === true)}
            disabled={saving}
          />
          <Label htmlFor="add-location-another" className="font-normal">
            Add another after this one
          </Label>
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={saving}
          data-testid="cancel-button-desktop"
        >
          {created.length > 0 && addAnother ? "Done" : "Cancel"}
        </Button>
        <Button type="submit" disabled={saving} data-testid="submit-button-desktop">
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          {saving ? "Creating…" : "Create location"}
        </Button>
      </DialogFooter>
    </form>
  )
}
