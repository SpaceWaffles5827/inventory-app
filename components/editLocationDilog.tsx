"use client"

import { useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { updateLocationApi, type LocationWithCount, type UpdateLocationRequest } from "@/lib/api/locations.api"
import { ApiError, getErrorMessage } from "@/lib/api/client"
import { BarcodeField } from "@/components/locations/barcode-field"
import { CodePreview, LocationLevelsEditor } from "@/components/locations/location-levels-editor"
import { useLocationCodes } from "@/components/locations/use-location-codes"
import { toLocationWithCount, type EditableLocation } from "@/components/locations/types"
import {
  barcodeForCodeChange,
  composeLocationCode,
  draftsFromStructure,
  isGeneratedBarcode,
  newLevelId,
  parseCapacity,
  parseLocationStructure,
  structureFromDrafts,
  validateBarcode,
  validateLocationLevels,
  type LevelDraft,
} from "@/components/locations/structure"

interface EditLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  location: EditableLocation | null
  onSuccess: (location: LocationWithCount) => void
  /** Existing codes for instant duplicate checks; fetched in the background when omitted */
  existingCodes?: string[]
}

export function EditLocationDialog({ open, onOpenChange, location, ...rest }: EditLocationDialogProps) {
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open={open && location !== null} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" data-testid="edit-location-dialog">
        <DialogHeader>
          <DialogTitle>Edit location</DialogTitle>
          <DialogDescription>
            Update the code, barcode and details for{" "}
            <span className="font-mono font-medium text-foreground">{location?.code}</span>.
          </DialogDescription>
        </DialogHeader>
        {location && (
          <EditLocationForm
            key={location.id}
            location={location}
            onOpenChange={onOpenChange}
            saving={saving}
            setSaving={setSaving}
            {...rest}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function initialLevels(location: EditableLocation): LevelDraft[] {
  const structure = parseLocationStructure(location.structure)
  if (structure.length > 0) return draftsFromStructure(structure, true)
  // Locations created without a structure: edit the whole code as one level
  return [{ id: newLevelId(), label: "Code", value: location.code, fixed: true }]
}

function EditLocationForm({
  location,
  workspaceId,
  onOpenChange,
  onSuccess,
  existingCodes,
  saving,
  setSaving,
}: Omit<EditLocationDialogProps, "open" | "location"> & {
  location: EditableLocation
  saving: boolean
  setSaving: (saving: boolean) => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [levels, setLevels] = useState<LevelDraft[]>(() => initialLevels(location))
  const [barcode, setBarcode] = useState(location.barcode ?? "")
  const [capacity, setCapacity] = useState(String(location.capacity ?? ""))
  const [description, setDescription] = useState(location.description ?? "")
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<{ field: "code" | "barcode"; key: string; message: string } | null>(
    null
  )

  const knownCodes = useLocationCodes(workspaceId, existingCodes)
  const originalStructure = parseLocationStructure(location.structure)

  const code = composeLocationCode(levels.map((l) => l.value))
  const codeChanged = code !== location.code
  const structure = structureFromDrafts(levels)
  const structureChanged = JSON.stringify(structure) !== JSON.stringify(originalStructure)
  const levelCheck = validateLocationLevels(levels)
  const isDuplicate =
    Boolean(code) && code.toUpperCase() !== location.code.toUpperCase() && Boolean(knownCodes?.has(code))

  const codeError =
    (serverError?.field === "code" && serverError.key === code ? serverError.message : undefined) ??
    (isDuplicate ? `A location with code ${code} already exists` : undefined) ??
    (submitted ? levelCheck.form : undefined)

  const trimmedBarcode = barcode.trim()
  const barcodeUnchanged = trimmedBarcode === (location.barcode ?? "")
  const barcodeWillRegenerate =
    barcodeUnchanged && codeChanged && isGeneratedBarcode(location.barcode, location.code)
  const barcodeError =
    (serverError?.field === "barcode" && serverError.key === trimmedBarcode ? serverError.message : undefined) ??
    validateBarcode(barcode)

  const capacityCheck = capacity.trim() ? parseCapacity(capacity) : { error: "Enter a capacity" }

  const barcodeHint = barcodeWillRegenerate
    ? "Will be regenerated from the new code — reprint the label after saving"
    : trimmedBarcode
      ? "Printed labels encode this value"
      : "Leave blank to generate one from the code"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!levelCheck.valid || isDuplicate || capacityCheck.error || barcodeError) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }

    const payload: UpdateLocationRequest = {
      workspaceId,
      capacity: capacityCheck.value,
      description: description.trim(),
    }
    if (codeChanged || structureChanged) {
      payload.code = code
      payload.structure = structure
    }

    // Barcode rules: the server regenerates it when the code changes and no barcode is sent.
    if (!barcodeUnchanged && trimmedBarcode) {
      payload.barcode = trimmedBarcode
    } else if (!barcodeUnchanged) {
      // Cleared → use the generated form. With a new code the server generates it for us.
      if (!codeChanged && !isGeneratedBarcode(location.barcode, code)) payload.barcode = `LOC-${code}`
    } else if (codeChanged) {
      const keep = barcodeForCodeChange(location.barcode, location.code, code)
      if (keep !== undefined) payload.barcode = keep
    }

    setSaving(true)
    try {
      const res = await updateLocationApi(location.id, payload)
      const updated = res.data?.location
      if (!updated) throw new Error("The server didn't return the updated location")
      onSuccess(toLocationWithCount(updated))
      toast.success(`Location ${updated.code} updated`)
      onOpenChange(false)
    } catch (err) {
      const message = getErrorMessage(err, "Couldn't update the location")
      const conflict = err instanceof ApiError && err.status === 409
      if (/barcode/i.test(message)) {
        setServerError({ field: "barcode", key: trimmedBarcode, message })
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
      <section className="space-y-3" aria-labelledby="edit-location-code-heading">
        <h3 id="edit-location-code-heading" className="text-sm font-medium">
          Code
        </h3>
        <LocationLevelsEditor
          mode="location"
          idPrefix="edit-location"
          levels={levels}
          onChange={setLevels}
          errors={submitted ? levelCheck.byId : undefined}
          disabled={saving}
        />
        <CodePreview code={code} error={codeError} previousCode={location.code} />
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="edit-location-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="edit-location-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Cold storage, top shelf — forklift access only"
          rows={2}
          maxLength={191}
          disabled={saving}
          className="min-h-16 resize-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BarcodeField
          id="edit-location-barcode"
          value={barcode}
          onChange={setBarcode}
          error={barcodeError}
          hint={barcodeHint}
          disabled={saving}
          placeholder={code ? `LOC-${code}` : "Generated automatically"}
        />
        <div className="space-y-1.5">
          <Label htmlFor="edit-location-capacity">Capacity</Label>
          <Input
            id="edit-location-capacity"
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            aria-invalid={Boolean(capacityCheck.error) || undefined}
            aria-describedby="edit-location-capacity-help"
            disabled={saving}
            className="h-10 tabular-nums"
          />
          <p
            id="edit-location-capacity-help"
            className={capacityCheck.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
          >
            {capacityCheck.error ?? "Max units this location holds"}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="edit-location-submit">
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  )
}
