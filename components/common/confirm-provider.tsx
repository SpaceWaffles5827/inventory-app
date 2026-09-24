"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for destructive actions */
  destructive?: boolean
  /**
   * Optional async work to run while the dialog shows a spinner. If it throws, the dialog stays
   * open and the promise from confirm() resolves false (show your own toast in the action).
   */
  action?: () => Promise<void> | void
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Replaces window.confirm(). Usage:
 *   const confirm = useConfirm()
 *   if (await confirm({ title: "Delete item?", destructive: true })) { ... }
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [busy, setBusy] = useState(false)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
    setBusy(false)
  }

  const handleConfirm = async () => {
    if (!options?.action) return settle(true)
    setBusy(true)
    try {
      await options.action()
      settle(true)
    } catch {
      setBusy(false)
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={options !== null}
        onOpenChange={(open) => {
          if (!open && !busy) settle(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{options?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
            <Button
              variant={options?.destructive ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={busy}
              data-testid="confirm-dialog-confirm"
            >
              {busy && <Loader2 className="animate-spin" />}
              {options?.confirmLabel ?? (options?.destructive ? "Delete" : "Confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>")
  return ctx
}
