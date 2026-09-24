"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { loginUserApi } from "@/lib/api/auth.api"
import { getErrorMessage } from "@/lib/api/client"
import { PasswordInput } from "@/components/auth/password-input"
import { useSignedInRedirect } from "@/components/auth/use-signed-in-redirect"
import { firstErrorKey, readFields, validateEmail } from "@/components/auth/validation"
import {
  AuthFooterLine,
  AuthHeader,
  FormAlert,
  FormField,
  SignedInNotice,
  SubmitButton,
  describedBy,
  inlineLinkClass,
} from "@/components/auth/form-parts"

type Field = "email" | "password"
const FIELDS: readonly Field[] = ["email", "password"]

function validate(values: Record<Field, string>): Partial<Record<Field, string>> {
  return {
    email: validateEmail(values.email),
    password: values.password ? undefined : "Enter your password",
  }
}

export type LoginNotice = "registered" | "reset" | "invited" | "expired" | null

const NOTICES: Record<Exclude<LoginNotice, null>, { tone: "success" | "info"; text: string }> = {
  registered: { tone: "success", text: "Your account is ready. Sign in to get started." },
  reset: { tone: "success", text: "Your password has been updated. Sign in with your new password." },
  invited: { tone: "success", text: "You've joined the workspace. Sign in to get started." },
  expired: { tone: "info", text: "Please sign in to continue." },
}

export function LoginForm({ next, notice }: { next: string; notice: LoginNotice }) {
  const router = useRouter()
  const { signedInAs, redirecting, cancelRedirect } = useSignedInRedirect(next)

  // Mirror of the (uncontrolled) inputs, used only to show inline validation
  const [values, setValues] = useState<Record<Field, string>>({ email: "", password: "" })
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const allErrors = validate(values)
  const errors: Partial<Record<Field, string>> = {}
  for (const key of FIELDS) {
    if (submitted || touched[key]) errors[key] = allErrors[key]
  }
  const firstError = firstErrorKey(FIELDS, errors)
  // Exactly one element carries data-testid="error-message": the first field error, else the API error
  const errorTestId = (key: Field) => (key === firstError ? "error-message" : `${key}-error`)

  const sync = (key: Field, value: string) => setValues((v) => (v[key] === value ? v : { ...v, [key]: value }))
  const onChange = (key: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    sync(key, e.target.value)
    if (serverError) setServerError("")
  }
  // Empty-field errors wait for submit; a blur only validates something that was typed
  const onBlur = (key: Field) => (e: React.FocusEvent<HTMLInputElement>) => {
    sync(key, e.target.value)
    if (e.target.value) setTouched((t) => ({ ...t, [key]: true }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    cancelRedirect()

    const data = readFields(e.currentTarget, FIELDS)
    setValues(data)
    setSubmitted(true)
    setServerError("")

    const invalid = firstErrorKey(FIELDS, validate(data))
    if (invalid) {
      document.getElementById(invalid)?.focus()
      return
    }

    setLoading(true)
    try {
      const res = await loginUserApi({ email: data.email.trim(), password: data.password })
      if (res.status === "success") {
        router.replace(next)
        return
      }
      setServerError(res.message || "We couldn't sign you in. Please try again.")
    } catch (err) {
      setServerError(getErrorMessage(err, "We couldn't sign you in. Please try again."))
    }
    setLoading(false)
  }

  const noticeConfig = notice ? NOTICES[notice] : null

  return (
    <>
      <AuthHeader title="Welcome back" description="Sign in to your StockFlow account to continue." />

      <SignedInNotice
        signedInAs={signedInAs}
        redirecting={redirecting}
        href={next}
        alternative="sign in with a different account"
      />
      {noticeConfig && !signedInAs && (
        <FormAlert tone={noticeConfig.tone} className="mb-6" testId="login-notice">
          {noticeConfig.text}
        </FormAlert>
      )}

      <div data-testid="login-card">
        <form
          method="post"
          noValidate
          onSubmit={handleSubmit}
          onInput={cancelRedirect}
          onPointerDown={cancelRedirect}
          onKeyDown={cancelRedirect}
          className="space-y-5"
          data-testid="login-form"
        >
          <FormField id="email" label="Email" error={errors.email} errorTestId={errorTestId("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@company.com"
              required
              onChange={onChange("email")}
              onBlur={onBlur("email")}
              disabled={loading}
              aria-invalid={Boolean(errors.email) || undefined}
              aria-describedby={describedBy("email", { error: errors.email })}
              className="h-10"
              data-testid="email-input"
            />
          </FormField>

          <FormField
            id="password"
            label="Password"
            error={errors.password}
            errorTestId={errorTestId("password")}
            labelAction={
              <Link href="/forgot-password" className={`text-sm ${inlineLinkClass}`} data-testid="forgot-password-link">
                Forgot password?
              </Link>
            }
          >
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              required
              onChange={onChange("password")}
              onBlur={onBlur("password")}
              disabled={loading}
              aria-invalid={Boolean(errors.password) || undefined}
              aria-describedby={describedBy("password", { error: errors.password })}
              data-testid="password-input"
            />
          </FormField>

          {serverError && !firstError && <FormAlert testId="error-message">{serverError}</FormAlert>}

          <SubmitButton loading={loading} loadingLabel="Signing in…" data-testid="submit-button">
            Sign in
          </SubmitButton>
        </form>
      </div>

      <AuthFooterLine>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className={inlineLinkClass} data-testid="signup-link">
          Create one for free
        </Link>
      </AuthFooterLine>
    </>
  )
}
