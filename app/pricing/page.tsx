import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Building2, Check, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MarketingShell } from "@/components/marketing/marketing-shell"
import { FaqList, GridBackdrop, SectionHeading, type FaqItem } from "@/components/marketing/section"
import { CtaBanner } from "@/components/marketing/cta-banner"
import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/components/marketing/site-config"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for StockFlow. Every plan starts with a 14-day free trial — no credit card required.",
}

interface Plan {
  name: string
  description: string
  price: string
  teamSize: string
  features: string[]
  popular?: boolean
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    description: "Perfect for small teams getting started",
    price: "$29",
    teamSize: "1–5 people",
    features: [
      "Up to 500 items",
      "Basic analytics",
      "Email support",
      "1 warehouse location",
      "Works on phone, tablet & desktop",
      "Basic reporting",
    ],
  },
  {
    name: "Professional",
    description: "For growing businesses with more needs",
    price: "$79",
    teamSize: "6–20 people",
    features: [
      "Up to 5,000 items",
      "Advanced analytics",
      "Priority support",
      "5 warehouse locations",
      "Works on phone, tablet & desktop",
      "Advanced reporting",
      "API access",
      "Custom categories",
    ],
    popular: true,
  },
  {
    name: "Business",
    description: "Advanced features for larger operations",
    price: "$149",
    teamSize: "21–50 people",
    features: [
      "Up to 25,000 items",
      "Real-time analytics",
      "24/7 phone support",
      "Unlimited locations",
      "Works on phone, tablet & desktop",
      "Custom reporting",
      "Full API access",
      "Advanced integrations",
      "Dedicated account manager",
    ],
  },
  {
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    price: "$299",
    teamSize: "51–100 people",
    features: [
      "Unlimited items",
      "Enterprise analytics",
      "24/7 priority support",
      "Unlimited locations",
      "Works on phone, tablet & desktop",
      "Custom reporting",
      "Full API access",
      "Custom integrations",
      "Dedicated success team",
      "SLA guarantee",
      "Custom training",
    ],
  },
]

const FAQ: FaqItem[] = [
  {
    question: "Is there a free trial?",
    answer: "Yes. Every plan comes with a 14-day free trial, and you don't need a credit card to start.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes. You can upgrade or downgrade your plan at any time. Changes are reflected in your next billing cycle.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express) and offer annual billing with a discount.",
  },
  {
    question: "Do I need to buy scanners or other hardware?",
    answer:
      "No. StockFlow scans barcodes and QR codes with any phone or tablet camera. Handheld USB or Bluetooth scanners that type like a keyboard work too.",
  },
  {
    question: "I have a question that isn't answered here",
    answer: (
      <>
        Email us at{" "}
        <a href={CONTACT_MAILTO} className="font-medium text-primary underline-offset-4 hover:underline">
          {CONTACT_EMAIL}
        </a>{" "}
        and we&apos;ll get back to you.
      </>
    ),
  },
]

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article
      aria-labelledby={`plan-${plan.name.toLowerCase()}`}
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6 text-card-foreground shadow-xs",
        plan.popular && "border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/40"
      )}
    >
      {plan.popular && (
        <Badge className="absolute -top-3 left-6 shadow-sm" data-testid="plan-popular-badge">
          Most popular
        </Badge>
      )}
      <h2 id={`plan-${plan.name.toLowerCase()}`} className="text-lg font-semibold tracking-tight">
        {plan.name}
      </h2>
      <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">{plan.price}</span>
        <span className="text-sm text-muted-foreground">/month</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{plan.teamSize}</p>

      <Button asChild className="mt-6 w-full" variant={plan.popular ? "default" : "outline"}>
        <Link href="/signup" data-testid={`plan-${plan.name.toLowerCase()}-signup-link`}>
          Start free trial
          <ArrowRight />
        </Link>
      </Button>

      <ul className="mt-6 space-y-3 border-t pt-6" aria-label={`${plan.name} plan includes`}>
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="size-3" aria-hidden />
            </span>
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

export default function PricingPage() {
  return (
    <MarketingShell>
      <section aria-labelledby="pricing-heading" className="relative isolate overflow-hidden">
        <GridBackdrop />
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold text-primary">Pricing</p>
          <h1 id="pricing-heading" className="mx-auto mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Simple pricing that grows with your team
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
            Start with a 14-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      <section aria-label="Plans" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-5 rounded-2xl border bg-muted/40 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-6" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold tracking-tight">Need more than 100 people?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contact us for custom enterprise pricing and features tailored to your organization&apos;s needs.
            </p>
          </div>
          <Button asChild variant="outline" className="sm:shrink-0">
            <a href={CONTACT_MAILTO} data-testid="contact-sales-link">
              <Mail />
              Contact sales
            </a>
          </Button>
        </div>
      </section>

      <section aria-labelledby="pricing-faq-heading" className="border-t bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <SectionHeading
            id="pricing-faq-heading"
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Everything you need to know about plans and billing."
          />
          <FaqList items={FAQ} className="mt-10" />
        </div>
      </section>

      <CtaBanner title="Try StockFlow free for 14 days" />
    </MarketingShell>
  )
}
