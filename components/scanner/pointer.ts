"use client"

import { useState } from "react"

/** True on devices with a mouse/trackpad — used to autofocus fields only where it won't pop up a keyboard */
export function prefersFinePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(pointer: fine)").matches
}

export function useFinePointer(): boolean {
  const [fine] = useState(prefersFinePointer)
  return fine
}

/**
 * For Radix `onOpenAutoFocus`: on touch devices keep focus on the dialog itself instead of the
 * first field, so the on-screen keyboard doesn't cover the camera.
 */
export function focusDialogOnTouch(event: Event) {
  if (prefersFinePointer()) return
  event.preventDefault()
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.focus()
}
