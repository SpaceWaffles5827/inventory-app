"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, LayoutDashboard, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/marketing/brand"
import { CONTACT_MAILTO } from "@/components/marketing/site-config"

/**
 * Global error boundary for everything under the root layout (marketing, auth and dashboard pages).
 * Kept free of the marketing header so it also makes sense when a dashboard page fails.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the error for debugging / log collection
    console.error(error)
  }, [error])

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16 sm:px-6">
      <Link
        href="/"
        aria-label="StockFlow home"
        className="mb-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BrandMark className="text-foreground" />
      </Link>
      <div role="alert" className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          An unexpected error stopped this page from loading. Your data is safe — try again, or head back to somewhere
          familiar.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-muted-foreground">
            Error reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 grid gap-2">
          <Button size="lg" className="h-10" onClick={reset} data-testid="error-retry-button">
            <RotateCw />
            Try again
          </Button>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" size="lg" className="h-10">
              <Link href="/dashboard">
                <LayoutDashboard />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-10">
              <Link href="/">
                <ArrowLeft />
                Home
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Keeps happening?{" "}
        <a href={CONTACT_MAILTO} className="font-medium text-primary underline-offset-4 hover:underline">
          Contact support
        </a>
      </p>
    </main>
  )
}
