"use client"

import { useState, type FormEvent } from "react"
import { Building2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateWorkspaceApi } from "@/lib/api/workspace.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatDate } from "@/lib/format"
import { RoleBadge } from "../role-badge"
import { FieldError, SettingsSection } from "./settings-section"

const MAX_NAME = 100
const MAX_DESCRIPTION = 500

export function WorkspaceSettings() {
  const { workspace, role, isAdmin, refresh } = useWorkspace()
  const savedName = workspace?.name ?? ""
  const savedDescription = workspace?.description ?? ""

  const [name, setName] = useState(savedName)
  const [description, setDescription] = useState(savedDescription)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const trimmedName = name.trim()
  const trimmedDescription = description.trim()
  const nameError = !trimmedName
    ? "Give your workspace a name"
    : trimmedName.length > MAX_NAME
      ? `Keep it under ${MAX_NAME} characters`
      : null
  const descriptionError =
    trimmedDescription.length > MAX_DESCRIPTION ? `Keep it under ${MAX_DESCRIPTION} characters` : null
  const dirty = trimmedName !== savedName.trim() || trimmedDescription !== savedDescription.trim()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!workspace || nameError || descriptionError || !dirty) return
    setSaving(true)
    try {
      await updateWorkspaceApi(workspace.id, { name: trimmedName, description: trimmedDescription })
      await refresh()
      setName(trimmedName)
      setDescription(trimmedDescription)
      setTouched(false)
      toast.success("Workspace updated")
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update the workspace"))
    } finally {
      setSaving(false)
    }
  }

  const meta = (
    <span className="inline-flex flex-wrap items-center gap-2">
      {workspace?.createdAt && <span>Created {formatDate(workspace.createdAt)}</span>}
      {role && (
        <>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            Your role <RoleBadge role={role} />
          </span>
        </>
      )}
    </span>
  )

  if (!isAdmin) {
    return (
      <SettingsSection
        id="workspace"
        title="Workspace"
        description="Only admins and owners can change workspace details."
        icon={Building2}
        footerHint={meta}
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium break-words">{savedName || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Description</dt>
            <dd className="break-words">{savedDescription || <span className="text-muted-foreground">No description</span>}</dd>
          </div>
        </dl>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      id="workspace"
      title="Workspace"
      description="Shown in the workspace switcher and in invitation emails."
      icon={Building2}
      onSubmit={handleSubmit}
      footerHint={meta}
      footer={
        <>
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setName(savedName)
                setDescription(savedDescription)
                setTouched(false)
              }}
            >
              Discard
            </Button>
          )}
          <Button type="submit" disabled={saving || !dirty} data-testid="workspace-save">
            {saving && <Loader2 className="animate-spin" />}
            Save workspace
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2 sm:max-w-md">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            disabled={saving}
            className="h-10"
            aria-invalid={Boolean(touched && nameError)}
            aria-describedby={touched && nameError ? "workspace-name-error" : undefined}
            data-testid="workspace-name-input"
          />
          <FieldError id="workspace-name-error">{touched && nameError}</FieldError>
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="workspace-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <span
              className={
                trimmedDescription.length > MAX_DESCRIPTION
                  ? "text-xs text-destructive tabular-nums"
                  : "text-xs text-muted-foreground tabular-nums"
              }
            >
              {trimmedDescription.length}/{MAX_DESCRIPTION}
            </span>
          </div>
          <Textarea
            id="workspace-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Main distribution warehouse and returns area"
            disabled={saving}
            className="resize-y"
            aria-invalid={Boolean(descriptionError)}
            data-testid="workspace-description-input"
          />
          <FieldError>{descriptionError}</FieldError>
        </div>
      </div>
    </SettingsSection>
  )
}
