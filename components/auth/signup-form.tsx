"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { registerUserApi } from "@/lib/api/auth.api"
import { getErrorMessage } from "@/lib/api/client"
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input"
import { useSignedInRedirect } from "@/components/auth/use-signed-in-redirect"
import {
  DEFAULT_AFTER_LOGIN,
  firstErrorKey,
  readFields,
  validateConfirmPassword,
  validateEmail,
  validateNewPassword,
} from "@/components/auth/validation"
import {
  AuthFooterLine,
  AuthHeader,
  FieldError,
  FormAlert,
  FormField,
  SignedInNotice,
  SubmitButton,
  describedBy,
  inlineLinkClass,
} from "@/components/auth/form-parts"

type TextField = "name" | "email" | "password" | "confirmPassword"
type Field = TextField | "terms"
const TEXT_FIELDS: readonly TextField[] = ["name", "email", "password", "confirmPassword"]
const FIELD_ORDER: readonly Field[] = [...TEXT_FIELDS, "terms"]

type Values = Record<TextField, string> & { terms: boolean }

function validate(values: Values): Partial<Record<Field, string>> {
  return {
    name: values.name.trim() ? undefined : "Enter your name",
    email: validateEmail(values.email),
    password: validateNewPassword(values.password),
    confirmPassword: validateConfirmPassword(values.password, values.confirmPassword),
    terms: values.terms ? undefined : "You must agree to the Terms of Service and Privacy Policy",
  }
}

export function SignupForm() {
  const router = useRouter()
  const { signedInAs, redirecting, cancelRedirect } = useSignedInRedirect(DEFAULT_AFTER_LOGIN)

  // Mirror of the (uncontrolled) inputs, used for inline validation and the strength meter
  const [values, setValues] = useState<Values>({ name: "", email: "", password: "", confirmPassword: "", terms: false })
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const allErrors = validate(values)
  const errors: Partial<Record<Field, string>> = {}
  for (const key of FIELD_ORDER) {
    if (submitted || touched[key]) errors[key] = allErrors[key]
  }
  const firstError = firstErrorKey(FIELD_ORDER, errors)
  // Exactly one element carries data-testid="error-message": the first field error, else the API error
  const errorTestId = (key: Field) => (key === firstError ? "error-message" : `${key}-error`)

  const sync = (key: TextField, value: string) => setValues((v) => (v[key] === value ? v : { ...v, [key]: value }))
  const onChange = (key: TextField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    sync(key, e.target.value)
    if (serverError) setServerError("")
  }
  // Empty-field errors wait for submit; a blur only validates something that was typed
  const onBlur = (key: TextField) => (e: React.FocusEvent<HTMLInputElement>) => {
    sync(key, e.target.value)
    if (e.target.value) setTouched((t) => ({ ...t, [key]: true }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    cancelRedirect()

    const data: Values = { ...readFields(e.currentTarget, TEXT_FIELDS), terms: values.terms }
    setValues(data)
    setSubmitted(true)
    setServerError("")

    const invalid = firstErrorKey(FIELD_ORDER, validate(data))
    if (invalid) {
      document.getElementById(invalid)?.focus()
      return
    }

    // The API takes first/last name; a single-word name is sent as both (existing behaviour).
    const parts = data.name.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.slice(1).join(" ") || parts[0]

    setLoading(true)
    try {
      const res = await registerUserApi({ firstName, lastName, email: data.email.trim(), password: data.password })
      if (res.status === "success") {
        router.replace(res.data?.loggedIn ? DEFAULT_AFTER_LOGIN : "/login?registered=true")
        return
      }
      setServerError(res.message || "We couldn't create your account. Please try again.")
    } catch (err) {
      setServerError(getErrorMessage(err, "We couldn't create your account. Please try again."))
    }
    setLoading(false)
  }

  return (
    <>
      <AuthHeader title="Create your account" description="Start your 14-day free trial. No credit card required." />

      <SignedInNotice
        signedInAs={signedInAs}
        redirecting={redirecting}
        href={DEFAULT_AFTER_LOGIN}
        alternative="create a new account"
      />

      <div data-testid="signup-card">
        <form
          method="post"
          noValidate
          onSubmit={handleSubmit}
          onInput={cancelRedirect}
          onPointerDown={cancelRedirect}
          onKeyDown={cancelRedirect}
          className="space-y-5"
          data-testid="signup-form"
        >
          <FormField id="name" label="Full name" error={errors.name} errorTestId={errorTestId("name")}>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Alex Morgan"
              required
              onChange={onChange("name")}
              onBlur={onBlur("name")}
              disabled={loading}
              aria-invalid={Boolean(errors.name) || undefined}
              aria-describedby={describedBy("name", { error: errors.name })}
              className="h-10"
              data-testid="name-input"
            />
          </FormField>

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

          <FormField id="password" label="Password" error={errors.password} errorTestId={errorTestId("password")}>
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
            label="Confirm password"
            error={errors.confirmPassword}
            errorTestId={errorTestId("confirmPassword")}
          >
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              required
              onChange={onChange("confirmPassword")}
              onBlur={onBlur("confirmPassword")}
              disabled={loading}
              aria-invalid={Boolean(errors.confirmPassword) || undefined}
              aria-describedby={describedBy("confirmPassword", { error: errors.confirmPassword })}
              data-testid="confirm-password-input"
            />
          </FormField>

          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={values.terms}
                onCheckedChange={(checked) => {
                  setValues((v) => ({ ...v, terms: checked === true }))
                  setTouched((t) => ({ ...t, terms: true }))
                }}
                disabled={loading}
                aria-invalid={Boolean(errors.terms) || undefined}
                aria-describedby={describedBy("terms", { error: errors.terms })}
                className="mt-0.5 size-5"
                data-testid="terms-checkbox"
              />
              <label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed text-muted-foreground">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className={inlineLinkClass}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className={inlineLinkClass}>
                  Privacy Policy
                </Link>
              </label>
            </div>
            <FieldError id="terms-error" message={errors.terms} testId={errorTestId("terms")} />
          </div>

          {serverError && !firstError && <FormAlert testId="error-message">{serverError}</FormAlert>}

          <SubmitButton loading={loading} loadingLabel="Creating account…" data-testid="submit-button">
            Create account
          </SubmitButton>
        </form>
      </div>

      <AuthFooterLine>
        Already have an account?{" "}
        <Link href="/login" className={inlineLinkClass} data-testid="login-link">
          Sign in
        </Link>
      </AuthFooterLine>
    </>
  )
}
