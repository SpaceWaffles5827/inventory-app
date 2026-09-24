"use client"

import { useState, type FormEvent } from "react"
import { Loader2, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateUserProfileApi } from "@/lib/api/auth.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { MemberAvatar } from "../role-badge"
import { FieldError, SettingsSection } from "./settings-section"

const MAX_NAME = 255

export function ProfileSettings() {
  const { user, setUser } = useWorkspace()
  const savedName = user?.name ?? ""
  const [name, setName] = useState(savedName)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  const trimmed = name.trim()
  const error = !trimmed ? "Enter your name" : trimmed.length > MAX_NAME ? `Keep it under ${MAX_NAME} characters` : null
  const dirty = trimmed !== savedName.trim()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (error || !dirty || !user) return
    setSaving(true)
    try {
      const res = await updateUserProfileApi({ name: trimmed })
      const updated = res.data?.user
      setUser(updated ? { id: updated.id, email: updated.email, name: updated.name } : { ...user, name: trimmed })
      setName(updated?.name ?? trimmed)
      setTouched(false)
      toast.success("Profile updated")
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update your profile"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      id="profile"
      title="Profile"
      description="How you appear to teammates in this and other workspaces."
      icon={UserRound}
      onSubmit={handleSubmit}
      footer={
        <>
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setName(savedName)
                setTouched(false)
              }}
            >
              Discard
            </Button>
          )}
          <Button type="submit" disabled={saving || !dirty} data-testid="profile-save">
            {saving && <Loader2 className="animate-spin" />}
            Save profile
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <MemberAvatar name={trimmed || savedName} email={user?.email} className="size-14" fallbackClassName="text-lg" />
          <div className="min-w-0">
            <p className="truncate font-medium">{trimmed || savedName || "Your name"}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={MAX_NAME + 10}
              disabled={saving}
              className="h-10"
              aria-invalid={Boolean(touched && error)}
              aria-describedby={touched && error ? "profile-name-error" : undefined}
              data-testid="profile-name-input"
            />
            <FieldError id="profile-name-error">{touched && error}</FieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={user?.email ?? ""}
              readOnly
              disabled
              className="h-10"
              aria-describedby="profile-email-hint"
            />
            <p id="profile-email-hint" className="text-xs text-muted-foreground">
              Your sign-in email can&apos;t be changed.
            </p>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
