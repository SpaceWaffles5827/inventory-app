import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, LayoutDashboard, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { GridBackdrop } from "@/components/marketing/section"
import { CONTACT_MAILTO } from "@/components/marketing/site-config"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main id="main" className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-20 sm:px-6">
        <GridBackdrop />
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-card text-primary shadow-sm">
            <SearchX className="size-7" aria-hidden />
          </span>
          <p className="mt-6 font-mono text-sm font-medium text-primary">404</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">We couldn&apos;t find that page</h1>
          <p className="mt-3 text-base text-pretty text-muted-foreground">
            The link may be broken, or the page may have moved. Check the address, or head somewhere useful below.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-10">
              <Link href="/dashboard">
                <LayoutDashboard />
                Go to dashboard
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-10">
              <Link href="/">
                <ArrowLeft />
                Back to home
              </Link>
            </Button>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Think something should be here?{" "}
            <a href={CONTACT_MAILTO} className="font-medium text-primary underline-offset-4 hover:underline">
              Let us know
            </a>
            .
          </p>
        </div>
      </main>
      <SiteFooter variant="compact" />
    </div>
  )
}
