import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CONTACT_MAILTO } from "@/components/marketing/site-config"

/** Closing call-to-action shared by the landing and pricing pages */
export function CtaBanner({
  title = "Get your stock under control",
  description = "Set up your first workspace in minutes. Start with a 14-day free trial — no credit card required.",
}: {
  title?: string
  description?: string
}) {
  return (
    <section aria-labelledby="cta-heading" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border bg-card px-6 py-14 text-center shadow-sm sm:px-12 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-primary/5" />
          <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:20px_20px] opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        </div>
        <div className="relative">
          <h2 id="cta-heading" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-11 px-6 text-base">
              <Link href="/signup" data-testid="cta-signup-link">
                Start free
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6 text-base">
              <a href={CONTACT_MAILTO}>
                <Mail />
                Talk to us
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
