"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight, Building2, CalendarClock, Loader2, MailX, Shield, UserRound, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { acceptInvitationApi, verifyInvitationApi, type InvitationWithWorkspace } from "@/lib/api/invitations.api"
import { getUserProfileApi, loginUserApi } from "@/lib/api/auth.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatDate } from "@/lib/format"
import { WORKSPACE_STORAGE_KEY } from "@/lib/workspace-context"
import { ROLE_META, normalizeRole } from "@/components/workspace/roles"
import { RoleBadge } from "@/components/workspace/role-badge"
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input"
import { firstErrorKey, validateConfirmPassword, validateNewPassword } from "@/components/auth/validation"
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

type Field = "name" | "password" | "confirmPassword"

type State =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; invitation: InvitationWithWorkspace; isExistingUser: boolean }

export function AcceptInvitationView({ token, email }: { token: string | null; email: string | null }) {
  const [state, setState] = useState<State>(() =>
    token ? { kind: "loading" } : { kind: "invalid", message: "This invitation link is incomplete — it's missing its code." }
  )
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    verifyInvitationApi({ token, email: email ?? "" })
      .then((res) => {
        if (cancelled) return
        const invitation = res.data?.invitation
        if (!invitation) {
          setState({ kind: "invalid", message: res.message || "We couldn't find this invitation." })
          return
        }
        setState({ kind: "ready", invitation, isExistingUser: Boolean(res.data?.isExistingUser) })
      })
      .catch((err) => {
        if (!cancelled) setState({ kind: "invalid", message: getErrorMessage(err, "We couldn't verify this invitation.") })
      })
    // Is someone already signed in on this device? Used to warn about account mix-ups.
    getUserProfileApi()
      .then((res) => {
        if (!cancelled && res.data?.user?.email) setSignedInEmail(res.data.user.email)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token, email])

  if (state.kind === "loading") return <LoadingState />
  if (state.kind === "invalid") return <InvalidState message={state.message} />
  return (
    <AcceptForm
      token={token as string}
      invitation={state.invitation}
      isExistingUser={state.isExistingUser}
      signedInEmail={signedInEmail}
    />
  )
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" data-testid="invitation-loading">
      <span className="sr-only">Checking your invitation…</span>
      <Skeleton className="size-12 rounded-full" />
      <Skeleton className="mt-5 h-8 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-8 h-40 w-full rounded-xl" />
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
        Checking your invitation…
      </div>
    </div>
  )
}

function InvalidState({ message }: { message: string }) {
  return (
    <div data-testid="invitation-invalid">
      <AuthHeader
        icon={<StatusIcon icon={MailX} tone="destructive" />}
        title="This invitation can't be used"
        description={message}
      />
      <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">This usually happens when:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>the invitation has expired — invitations are valid for 7 days</li>
          <li>it has already been accepted</li>
          <li>a workspace admin cancelled it</li>
          <li>the link was copied incompletely</li>
        </ul>
        <p className="mt-3">Ask a workspace owner or admin to send you a new invitation.</p>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button asChild size="lg" className="h-10">
          <Link href="/login">Go to log in</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-10">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  )
}

function InvitationSummary({ invitation }: { invitation: InvitationWithWorkspace }) {
  const role = ROLE_META[normalizeRole(invitation.role)]
  const rows = [
    { icon: Building2, label: "Workspace", value: <span className="font-medium">{invitation.workspace?.name}</span> },
    { icon: UserRound, label: "Invited email", value: <span className="break-words">{invitation.email}</span> },
    {
      icon: Shield,
      label: "Role",
      value: (
        <span className="flex flex-col items-start gap-1" data-testid="invitation-role">
          <RoleBadge role={invitation.role} />
          <span className="text-xs leading-relaxed text-muted-foreground">{role.description}</span>
        </span>
      ),
    },
    { icon: CalendarClock, label: "Expires", value: formatDate(invitation.expiresAt) },
  ]
  return (
    <dl className="divide-y rounded-xl border bg-card text-sm shadow-xs">
      {rows.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-start gap-3 px-4 py-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 flex-1">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function AcceptForm({
  token,
  invitation,
  isExistingUser,
  signedInEmail,
}: {
  token: string
  invitation: InvitationWithWorkspace
  isExistingUser: boolean
  signedInEmail: string | null
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<Field, string>>({ name: "", password: "", confirmPassword: "" })
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const fieldOrder: readonly Field[] = isExistingUser ? ["password"] : ["name", "password", "confirmPassword"]
  const allErrors: Partial<Record<Field, string>> = isExistingUser
    ? { password: values.password ? undefined : "Enter your password" }
    : {
        name: values.name.trim() ? undefined : "Enter your name",
        password: validateNewPassword(values.password),
        confirmPassword: validateConfirmPassword(values.password, values.confirmPassword),
      }
  const errors: Partial<Record<Field, string>> = {}
  for (const key of fieldOrder) {
    if (submitted || touched[key]) errors[key] = allErrors[key]
  }
  const firstError = firstErrorKey(fieldOrder, errors)

  const onChange = (key: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    if (serverError) setServerError("")
  }
  const onBlur = (key: Field) => () => {
    if (values[key]) setTouched((t) => ({ ...t, [key]: true }))
  }

  const openWorkspace = useCallback(() => {
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, invitation.workspaceId)
    } catch {
      // storage unavailable — the dashboard falls back to the first workspace
    }
  }, [invitation.workspaceId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setSubmitted(true)
    setServerError("")

    const invalid = firstErrorKey(fieldOrder, allErrors)
    if (invalid) {
      document.getElementById(invalid)?.focus()
      return
    }

    setLoading(true)
    try {
      await acceptInvitationApi({
        token,
        email: invitation.email,
        password: values.password,
        name: isExistingUser ? undefined : values.name.trim(),
      })
    } catch (err) {
      setServerError(getErrorMessage(err, "We couldn't accept this invitation. Please try again."))
      setLoading(false)
      return
    }

    // Joined — sign in with the credentials just entered so the user lands straight in the workspace.
    openWorkspace()
    try {
      await loginUserApi({ email: invitation.email, password: values.password })
      toast.success(`Welcome to ${invitation.workspace?.name ?? "your new workspace"}`)
      router.replace("/dashboard")
    } catch {
      router.replace("/login?invited=1")
    }
  }

  const workspaceName = invitation.workspace?.name ?? "a workspace"
  const signedInAsSomeoneElse =
    signedInEmail && signedInEmail.toLowerCase() !== invitation.email.toLowerCase() ? signedInEmail : null

  return (
    <>
      <AuthHeader
        icon={<StatusIcon icon={Users} />}
        title={<>Join {workspaceName}</>}
        description="You've been invited to collaborate on StockFlow. Review the details below to accept."
      />

      <InvitationSummary invitation={invitation} />

      {signedInAsSomeoneElse && (
        <FormAlert tone="info" className="mt-6" testId="invitation-account-mismatch">
          You&apos;re currently signed in as <span className="font-medium break-words">{signedInAsSomeoneElse}</span>.
          This invitation is for <span className="font-medium break-words">{invitation.email}</span>, and accepting it
          will sign you in to that account instead.
        </FormAlert>
      )}

      <form
        method="post"
        noValidate
        onSubmit={handleSubmit}
        className="mt-8 space-y-5"
        data-testid="accept-invitation-form"
        aria-labelledby="accept-form-heading"
      >
        <div>
          <h2 id="accept-form-heading" className="text-base font-semibold">
            {isExistingUser ? "Sign in to accept" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isExistingUser
              ? `You already have a StockFlow account for ${invitation.email}. Enter your password to join.`
              : `Set up your StockFlow login for ${invitation.email}.`}
          </p>
        </div>

        {/* lets password managers pair the saved password with the right account */}
        <input type="hidden" name="email" autoComplete="username" value={invitation.email} readOnly />

        {!isExistingUser && (
          <FormField id="name" label="Full name" error={errors.name} errorTestId="name-error">
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Alex Morgan"
              required
              value={values.name}
              onChange={onChange("name")}
              onBlur={onBlur("name")}
              disabled={loading}
              aria-invalid={Boolean(errors.name) || undefined}
              aria-describedby={describedBy("name", { error: errors.name })}
              className="h-10"
              data-testid="name-input"
            />
          </FormField>
        )}

        <FormField
          id="password"
          label={isExistingUser ? "Password" : "Create a password"}
          error={errors.password}
          errorTestId="password-error"
          labelAction={
            isExistingUser ? (
              <Link href="/forgot-password" className={`text-sm ${inlineLinkClass}`}>
                Forgot password?
              </Link>
            ) : undefined
          }
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete={isExistingUser ? "current-password" : "new-password"}
            placeholder={isExistingUser ? "Your password" : "At least 8 characters"}
            required
            value={values.password}
            onChange={onChange("password")}
            onBlur={onBlur("password")}
            disabled={loading}
            aria-invalid={Boolean(errors.password) || undefined}
            aria-describedby={describedBy("password", { hint: !isExistingUser, error: errors.password })}
            data-testid="password-input"
          />
          {!isExistingUser && <PasswordStrength id="password-hint" password={values.password} />}
        </FormField>

        {!isExistingUser && (
          <FormField
            id="confirmPassword"
            label="Confirm password"
            error={errors.confirmPassword}
            errorTestId="confirm-password-error"
          >
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              required
              value={values.confirmPassword}
              onChange={onChange("confirmPassword")}
              onBlur={onBlur("confirmPassword")}
              disabled={loading}
              aria-invalid={Boolean(errors.confirmPassword) || undefined}
              aria-describedby={describedBy("confirmPassword", { error: errors.confirmPassword })}
              data-testid="confirm-password-input"
            />
          </FormField>
        )}

        {serverError && !firstError && <FormAlert testId="error-message">{serverError}</FormAlert>}

        <SubmitButton
          loading={loading}
          loadingLabel="Joining workspace…"
          data-testid="accept-invitation-button"
        >
          {isExistingUser ? "Accept and join" : "Create account and join"}
          <ArrowRight />
        </SubmitButton>

        {!isExistingUser && (
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            By joining you agree to the{" "}
            <Link href="/terms" target="_blank" className={inlineLinkClass}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className={inlineLinkClass}>
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </form>

      <AuthFooterLine>
        Not expecting this invitation? You can safely ignore it.
      </AuthFooterLine>
    </>
  )
}
