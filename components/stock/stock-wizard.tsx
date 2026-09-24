"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { AlertCircle, ChevronLeft, Loader2, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/common/states"
import { prefersFinePointer } from "@/components/scanner/pointer"
import { cn } from "@/lib/utils"

export interface WizardStep {
  id: string
  label: string
}

/**
 * Dialog shell for the stock flows: a bottom sheet on phones / modal on desktop, laid out so the
 * header and footer stay put while the step body scrolls. Closing is blocked while `busy`.
 * The content (usually a <WizardFrame>) is unmounted on close, so every open starts fresh.
 */
export function StockDialog({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: (controls: { setBusy: (busy: boolean) => void; close: () => void }) => ReactNode
  className?: string
}) {
  const [busy, setBusy] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 pb-0 sm:max-w-lg sm:p-0 sm:pb-0",
          className
        )}
      >
        {children({
          setBusy,
          close: () => {
            setBusy(false)
            onOpenChange(false)
          },
        })}
      </DialogContent>
    </Dialog>
  )
}

function StepIndicator({ steps, current }: { steps: WizardStep[]; current: string }) {
  const index = Math.max(0, steps.findIndex((s) => s.id === current))
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden>
        {steps.map((step, i) => (
          <span
            key={step.id}
            className={cn("h-1 flex-1 rounded-full transition-colors", i <= index ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">
        Step {index + 1} of {steps.length} · <span className="font-medium text-foreground">{steps[index].label}</span>
      </p>
    </div>
  )
}

interface WizardHeaderProps {
  title: string
  description?: ReactNode
  icon?: LucideIcon
  steps?: WizardStep[]
  currentStep?: string
}

function WizardHeader({ title, description, icon: Icon, steps, currentStep }: WizardHeaderProps) {
  return (
    <div className="shrink-0 space-y-3 border-b px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {Icon && <Icon className="size-5 shrink-0 text-primary" aria-hidden />}
          {title}
        </DialogTitle>
        <DialogDescription className={cn(!description && "sr-only")}>{description ?? title}</DialogDescription>
      </DialogHeader>
      {steps && steps.length > 1 && currentStep && <StepIndicator steps={steps} current={currentStep} />}
    </div>
  )
}

interface WizardFrameProps extends WizardHeaderProps {
  /** data-testid on the step container (e2e tests key off `…-dialog-<step>`) */
  testId?: string
  /** Pinned above the step body, e.g. the item summary */
  top?: ReactNode
  children: ReactNode
  /** Inline error shown right above the footer */
  error?: string | null
  /** Form submit — Enter in any field or the primary button */
  onSubmit: () => void
  onBack: () => void
  backLabel?: string
  submitLabel: ReactNode
  submitDisabled?: boolean
  submitTestId?: string
  submitVariant?: "default" | "destructive"
  busy?: boolean
}

/** One step of a stock wizard: header + step indicator, scrolling body, sticky Back / Next footer */
export function WizardFrame({
  testId,
  title,
  description,
  icon,
  steps,
  currentStep,
  top,
  children,
  error,
  onSubmit,
  onBack,
  backLabel = "Back",
  submitLabel,
  submitDisabled,
  submitTestId,
  submitVariant = "default",
  busy,
}: WizardFrameProps) {
  const isCancel = backLabel === "Cancel"
  const contentRef = useRef<HTMLDivElement>(null)

  // Each step starts with focus inside it: the first field on desktop (so typing / Enter just works),
  // the step itself on touch devices (so the on-screen keyboard doesn't jump up).
  useEffect(() => {
    const content = contentRef.current
    if (!content || content.contains(document.activeElement)) return
    const target = prefersFinePointer()
      ? (content.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled)") ??
        content.querySelector<HTMLElement>('[role="radio"][tabindex="0"]:not(:disabled)'))
      : null
    ;(target ?? content).focus({ preventScroll: true })
  }, [currentStep, testId])

  return (
    <form
      data-testid={testId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!submitDisabled && !busy) onSubmit()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <WizardHeader title={title} description={description} icon={icon} steps={steps} currentStep={currentStep} />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        {top}
        <div ref={contentRef} tabIndex={-1} className="space-y-4 outline-none">
          {children}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="stock-flow-error"
          className="mx-4 mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive sm:mx-6"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0 break-words">{error}</p>
        </div>
      )}

      <div className="shrink-0 border-t bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
        <div className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 sm:flex-none"
            onClick={onBack}
            disabled={busy}
          >
            {!isCancel && <ChevronLeft />}
            {backLabel}
          </Button>
          <Button
            type="submit"
            variant={submitVariant}
            className="h-11 flex-[2] sm:min-w-36 sm:flex-none"
            disabled={submitDisabled || busy}
            data-testid={submitTestId}
          >
            {busy && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** Placeholder frame while the flow loads fresh item data */
export function WizardLoading({
  title,
  icon,
  onCancel,
  testId,
}: {
  title: string
  icon?: LucideIcon
  onCancel: () => void
  testId?: string
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={testId} aria-busy>
      <WizardHeader title={title} icon={icon} description="Loading current stock…" />
      <div className="space-y-3 px-4 py-4 sm:px-6">
        <Skeleton className="h-[68px] w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-2/3 rounded-xl" />
      </div>
      <div className="border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
        <div className="flex sm:justify-end">
          <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Error frame when the item couldn't be loaded */
export function WizardLoadError({
  title,
  icon,
  message,
  onRetry,
  onCancel,
}: {
  title: string
  icon?: LucideIcon
  message: string
  onRetry: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WizardHeader title={title} icon={icon} />
      <div className="px-4 py-4 sm:px-6">
        <ErrorState title="Couldn't load this item" message={message} onRetry={onRetry} />
      </div>
      <div className="border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
        <div className="flex sm:justify-end">
          <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Friendly dead-end inside a wizard (e.g. "nothing to transfer") */
export function WizardEmpty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}
