import Link from "next/link"
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** Page title + intro at the top of an auth form (the page's only <h1>) */
export function AuthHeader({
  title,
  description,
  icon,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-8", className)}>
      {icon && <div className="mb-5">{icon}</div>}
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{title}</h1>
      {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>}
    </div>
  )
}

/** Round tinted icon used above auth headings for success / error states */
export function StatusIcon({
  icon: Icon,
  tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: "primary" | "success" | "destructive"
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/12 text-success",
    destructive: "bg-destructive/10 text-destructive",
  }
  return (
    <span className={cn("flex size-12 items-center justify-center rounded-full", tones[tone])} aria-hidden>
      <Icon className="size-6" />
    </span>
  )
}

/** ids to pass to an input's aria-describedby */
export function describedBy(id: string, { hint, error }: { hint?: boolean; error?: string }) {
  const ids = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean)
  return ids.length ? ids.join(" ") : undefined
}

/** Label + control + hint + inline error */
export function FormField({
  id,
  label,
  labelAction,
  hint,
  error,
  errorTestId,
  children,
  className,
}: {
  id: string
  label: React.ReactNode
  /** e.g. a "Forgot password?" link shown on the label row */
  labelAction?: React.ReactNode
  hint?: React.ReactNode
  error?: string
  errorTestId?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children}
      {hint && !error && (
        <div id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </div>
      )}
      <FieldError id={`${id}-error`} message={error} testId={errorTestId} />
    </div>
  )
}

export function FieldError({ id, message, testId }: { id: string; message?: string; testId?: string }) {
  if (!message) return null
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm text-destructive" data-testid={testId}>
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  )
}

/** Form-level message: API errors, or notices like "account created" */
export function FormAlert({
  tone = "error",
  children,
  testId,
  className,
}: {
  tone?: "error" | "success" | "info"
  children: React.ReactNode
  testId?: string
  className?: string
}) {
  const styles = {
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    success: "border-success/30 bg-success/12 text-success",
    info: "border-info/30 bg-info/12 text-info",
  }
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-testid={testId}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", styles[tone], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  )
}

export function SubmitButton({
  loading,
  loadingLabel,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { loading: boolean; loadingLabel: string }) {
  return (
    <Button type="submit" size="lg" className={cn("h-10 w-full", className)} disabled={loading} aria-busy={loading} {...props}>
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {loading ? loadingLabel : children}
    </Button>
  )
}

/** Shown on login/signup when a session already exists (see useSignedInRedirect) */
export function SignedInNotice({
  signedInAs,
  redirecting,
  href,
  alternative,
}: {
  signedInAs: string | null
  redirecting: boolean
  href: string
  /** What the form below lets you do instead, e.g. "sign in with a different account" */
  alternative: string
}) {
  if (!signedInAs) return null
  return (
    <FormAlert tone="info" className="mb-6" testId="signed-in-notice">
      You&apos;re already signed in as <span className="font-medium break-words">{signedInAs}</span>.{" "}
      {redirecting ? (
        <>
          Taking you to your dashboard…{" "}
          <Link href={href} className="font-medium underline underline-offset-4">
            Go now
          </Link>
        </>
      ) : (
        <>
          <Link href={href} className="font-medium underline underline-offset-4">
            Go to your dashboard
          </Link>{" "}
          or {alternative} below.
        </>
      )}
    </FormAlert>
  )
}

/** "or" divider / footer line under a form */
export function AuthFooterLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 text-center text-sm text-muted-foreground">{children}</p>
}

export const inlineLinkClass =
  "rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
