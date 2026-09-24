"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getUserProfileApi } from "@/lib/api/auth.api"

const REDIRECT_DELAY_MS = 1200

/**
 * If a session already exists, show a short "you're already signed in" notice and then send the user on to `target`.
 * The redirect is cancelled as soon as the person starts using the form (typing, clicking, autofill), so it never
 * yanks the page away mid-entry — e.g. when someone wants to sign in with a different account.
 */
export function useSignedInRedirect(target: string) {
  const router = useRouter()
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const interactedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    getUserProfileApi()
      .then((res) => {
        const user = res?.data?.user
        if (cancelled || !user) return
        setSignedInAs(user.email || user.name || "your account")
        if (interactedRef.current) return
        setRedirecting(true)
        timerRef.current = setTimeout(() => router.replace(target), REDIRECT_DELAY_MS)
      })
      .catch(() => {
        // Not signed in (401) or the API is unreachable — just show the form.
      })
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router, target])

  /** Attach to the form's onInput / onPointerDown / onKeyDown */
  const cancelRedirect = useCallback(() => {
    interactedRef.current = true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      setRedirecting(false)
    }
  }, [])

  return { signedInAs, redirecting, cancelRedirect }
}
