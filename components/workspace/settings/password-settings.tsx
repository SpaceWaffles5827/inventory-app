"use client"

import { useState, type FormEvent } from "react"
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changePasswordApi } from "@/lib/api/auth.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { FieldError, SettingsSection } from "./settings-section"

const MIN_LENGTH = 8
/** bcrypt only uses the first 72 bytes — the API rejects anything longer */
const MAX_BYTES = 72

function byteLength(value: string) {
  return new TextEncoder().encode(value).length
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  disabled,
  testId,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  error?: string | null
  hint?: string
  disabled?: boolean
  testId?: string
}) {
  const [visible, setVisible] = useState(false)
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10 pr-11"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          data-testid={testId}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function PasswordSettings() {
  const { user } = useWorkspace()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirmValue, setConfirmValue] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const errors = {
    current: !current ? "Enter your current password" : null,
    next: !next
      ? "Enter a new password"
      : next.length < MIN_LENGTH
        ? `Use at least ${MIN_LENGTH} characters`
        : byteLength(next) > MAX_BYTES
          ? "That password is too long — keep it under 72 characters"
          : current && next === current
          ? "Choose a password different from your current one"
          : null,
    confirm: !confirmValue ? "Confirm your new password" : confirmValue !== next ? "Passwords don't match" : null,
  }
  const hasErrors = Boolean(errors.current || errors.next || errors.confirm)
  const anyInput = Boolean(current || next || confirmValue)
  const currentIsWrong = serverError !== null && /current password/i.test(serverError)

  const reset = () => {
    setCurrent("")
    setNext("")
    setConfirmValue("")
    setSubmitted(false)
    setServerError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (hasErrors) return
    setSaving(true)
    try {
      const res = await changePasswordApi(current, next, confirmValue)
      const revoked = Number((res.data as { otherSessionsRevoked?: unknown } | undefined)?.otherSessionsRevoked ?? 0)
      reset()
      toast.success("Password updated", {
        description: revoked > 0 ? "You were signed out on your other devices." : undefined,
      })
    } catch (err) {
      setServerError(getErrorMessage(err, "Couldn't change your password"))
    } finally {
      setSaving(false)
    }
  }

  // Live-validate the confirmation once the user has typed it; everything else waits for submit
  const show = (key: keyof typeof errors) =>
    submitted || (key === "confirm" && confirmValue.length > 0) || (key === "next" && next.length >= MIN_LENGTH)
      ? errors[key]
      : null

  return (
    <SettingsSection
      id="password"
      title="Password"
      description="Changing your password signs you out everywhere except this device."
      icon={KeyRound}
      onSubmit={handleSubmit}
      footer={
        <>
          {anyInput && (
            <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
              Clear
            </Button>
          )}
          <Button type="submit" disabled={saving || !anyInput} data-testid="password-save">
            {saving && <Loader2 className="animate-spin" />}
            Update password
          </Button>
        </>
      }
    >
      {/* Lets password managers associate the new password with the right account */}
      <input type="email" name="username" autoComplete="username" value={user?.email ?? ""} readOnly hidden />
      <div className="space-y-5">
        {serverError && !currentIsWrong && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}
        <div className="sm:max-w-sm">
          <PasswordField
            id="current-password"
            label="Current password"
            value={current}
            onChange={(v) => {
              setCurrent(v)
              if (currentIsWrong) setServerError(null)
            }}
            autoComplete="current-password"
            error={show("current") ?? (currentIsWrong ? "That's not your current password" : null)}
            disabled={saving}
            testId="current-password-input"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            id="new-password"
            label="New password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            error={show("next")}
            hint={`At least ${MIN_LENGTH} characters`}
            disabled={saving}
            testId="new-password-input"
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirmValue}
            onChange={setConfirmValue}
            autoComplete="new-password"
            error={show("confirm")}
            disabled={saving}
            testId="confirm-password-input"
          />
        </div>
      </div>
    </SettingsSection>
  )
}
