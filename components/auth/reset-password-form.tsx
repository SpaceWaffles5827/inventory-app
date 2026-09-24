"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, KeyRound, LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resetPasswordApi } from "@/lib/api/auth.api"
import { getErrorMessage } from "@/lib/api/client"
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input"
import { firstErrorKey, readFields, validateConfirmPassword, validateNewPassword } from "@/components/auth/validation"
import {
  AuthFooterLine,
  AuthHeader,
  FormAlert,
  FormField,
  StatusIcon,
  SubmitButton,
  describedBy,
  inlineLinkClass,
} from "@/components/auth/form-parts"

type Field = "password" | "confirmPassword"
const FIELD_ORDER: readonly Field[] = ["password", "confirmPassword"]
const LOGIN_AFTER_RESET = "/login?reset=1"

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<Field, string>>({ password: "", confirmPassword: "" })
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // After a successful reset, move on to the login page automatically
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => router.push(LOGIN_AFTER_RESET), 2500)
    return () => clearTimeout(timer)
  }, [done, router])

  if (!token) {
    return (
      <>
        <AuthHeader
          icon={<StatusIcon icon={LinkIcon} tone="destructive" />}
          title="This reset link isn't valid"
          description="The link is missing its reset code. It may have been copied incompletely — request a new one and use the button in the email."
        />
        <Button asChild size="lg" className="h-10 w-full">
          <Link href="/forgot-password">Request a new reset link</Link>
        </Button>
        <AuthFooterLine>
          <Link href="/login" className={inlineLinkClass}>
            Back to log in
          </Link>
        </AuthFooterLine>
      </>
    )
  }

  if (done) {
    return (
      <>
        <AuthHeader
          icon={<StatusIcon icon={CheckCircle2} tone="success" />}
          title="Password updated"
          description="Your password has been changed. Taking you to the log in page…"
        />
        <Button asChild size="lg" className="h-10 w-full">
          <Link href={LOGIN_AFTER_RESET}>
            Continue to log in
            <ArrowRight />
          </Link>
        </Button>
      </>
    )
  }

  const allErrors: Partial<Record<Field, string>> = {
    password: validateNewPassword(values.password),
    confirmPassword: validateConfirmPassword(values.password, values.confirmPassword),
  }
  const errors: Partial<Record<Field, string>> = {}
  for (const key of FIELD_ORDER) {
    if (submitted || touched[key]) errors[key] = allErrors[key]
  }
  const firstError = firstErrorKey(FIELD_ORDER, errors)

  const sync = (key: Field, value: string) => setValues((v) => (v[key] === value ? v : { ...v, [key]: value }))
  const onChange = (key: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    sync(key, e.target.value)
    if (serverError) setServerError("")
  }
  const onBlur = (key: Field) => (e: React.FocusEvent<HTMLInputElement>) => {
    sync(key, e.target.value)
    if (e.target.value) setTouched((t) => ({ ...t, [key]: true }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading || !token) return
    const data = readFields(e.currentTarget, FIELD_ORDER)
    setValues(data)
    setSubmitted(true)
    setServerError("")

    const invalid = firstErrorKey(FIELD_ORDER, {
      password: validateNewPassword(data.password),
      confirmPassword: validateConfirmPassword(data.password, data.confirmPassword),
    })
    if (invalid) {
      document.getElementById(invalid)?.focus()
      return
    }

    setLoading(true)
    try {
      await resetPasswordApi(token, data.password, data.confirmPassword)
      setDone(true)
    } catch (err) {
      setServerError(getErrorMessage(err, "We couldn't reset your password. The link may have expired."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AuthHeader
        icon={<StatusIcon icon={KeyRound} />}
        title="Choose a new password"
        description="Pick something you haven't used before. You'll use it to sign in from now on."
      />
      <form method="post" noValidate onSubmit={handleSubmit} className="space-y-5" data-testid="reset-password-form">
        <FormField id="password" label="New password" error={errors.password} errorTestId="password-error">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            onChange={onChange("password")}
            onBlur={onBlur("password")}
            disabled={loading}
            aria-invalid={Boolean(errors.password) || undefined}
            aria-describedby={describedBy("password", { hint: true, error: errors.password })}
            data-testid="password-input"
          />
          <PasswordStrength id="password-hint" password={values.password} />
        </FormField>

        <FormField
          id="confirmPassword"
          label="Confirm new password"
          error={errors.confirmPassword}
          errorTestId="confirm-password-error"
        >
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            required
            onChange={onChange("confirmPassword")}
            onBlur={onBlur("confirmPassword")}
            disabled={loading}
            aria-invalid={Boolean(errors.confirmPassword) || undefined}
            aria-describedby={describedBy("confirmPassword", { error: errors.confirmPassword })}
            data-testid="confirm-password-input"
          />
        </FormField>

        {serverError && !firstError && (
          <FormAlert testId="error-message">
            {serverError}{" "}
            <Link href="/forgot-password" className="font-medium underline underline-offset-4">
              Request a new link
            </Link>
          </FormAlert>
        )}

        <SubmitButton loading={loading} loadingLabel="Updating password…" data-testid="submit-button">
          Update password
        </SubmitButton>
      </form>

      <AuthFooterLine>
        <Link href="/login" className={inlineLinkClass}>
          Back to log in
        </Link>
      </AuthFooterLine>
    </>
  )
}
