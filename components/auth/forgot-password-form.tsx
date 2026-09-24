"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { forgotPasswordApi } from "@/lib/api/auth.api"
import { getErrorMessage } from "@/lib/api/client"
import { readFields, validateEmail } from "@/components/auth/validation"
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

export function ForgotPasswordForm() {
  // Mirror of the (uncontrolled) email input, for inline validation
  const [email, setEmail] = useState("")
  const [touched, setTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [serverError, setServerError] = useState("")

  const emailError = submitted || touched ? validateEmail(email) : undefined

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    const value = readFields(e.currentTarget, ["email"] as const).email.trim()
    setEmail(value)
    setSubmitted(true)
    setServerError("")
    if (validateEmail(value)) {
      document.getElementById("email")?.focus()
      return
    }

    setLoading(true)
    try {
      await forgotPasswordApi(value)
      setSentTo(value)
    } catch (err) {
      setServerError(getErrorMessage(err, "We couldn't send the reset email. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!sentTo || resending) return
    setResending(true)
    setResent(false)
    setServerError("")
    try {
      await forgotPasswordApi(sentTo)
      setResent(true)
    } catch (err) {
      setServerError(getErrorMessage(err, "We couldn't resend the email. Please try again."))
    } finally {
      setResending(false)
    }
  }

  if (sentTo) {
    return (
      <>
        <AuthHeader
          icon={<StatusIcon icon={MailCheck} tone="success" />}
          title="Check your email"
          description={
            <>
              If an account exists for <span className="font-medium break-words text-foreground">{sentTo}</span>,
              you&apos;ll get an email with a link to reset your password in the next few minutes.
            </>
          }
        />
        <div className="space-y-4" data-testid="forgot-password-sent">
          {serverError && <FormAlert testId="error-message">{serverError}</FormAlert>}
          {resent && !serverError && <FormAlert tone="success">We&apos;ve sent another email.</FormAlert>}
          <p className="text-sm text-muted-foreground">
            Didn&apos;t get it? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className={`${inlineLinkClass} inline-flex items-center gap-1 disabled:opacity-60`}
              data-testid="resend-button"
            >
              {resending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {resending ? "sending…" : "send it again"}
            </button>
            .
          </p>
          <Button asChild variant="outline" size="lg" className="h-10 w-full">
            <Link href="/login">
              <ArrowLeft />
              Back to log in
            </Link>
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <AuthHeader
        title="Reset your password"
        description="Enter the email address you use for StockFlow and we'll send you a link to choose a new password."
      />
      <form method="post" noValidate onSubmit={handleSubmit} className="space-y-5" data-testid="forgot-password-form">
        <FormField id="email" label="Email" error={emailError} errorTestId="email-error">
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
            onChange={(e) => {
              setEmail(e.target.value)
              if (serverError) setServerError("")
            }}
            onBlur={(e) => {
              setEmail(e.target.value)
              if (e.target.value) setTouched(true)
            }}
            disabled={loading}
            aria-invalid={Boolean(emailError) || undefined}
            aria-describedby={describedBy("email", { error: emailError })}
            className="h-10"
            data-testid="email-input"
          />
        </FormField>

        {serverError && <FormAlert testId="error-message">{serverError}</FormAlert>}

        <SubmitButton loading={loading} loadingLabel="Sending link…" data-testid="submit-button">
          Send reset link
        </SubmitButton>
      </form>

      <AuthFooterLine>
        Remembered it?{" "}
        <Link href="/login" className={inlineLinkClass}>
          Back to log in
        </Link>
      </AuthFooterLine>
    </>
  )
}
