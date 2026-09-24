// Plan catalogue shown on the Billing page. Names, prices and features mirror the public
// /pricing page (app/pricing/page.tsx) — keep the two in sync.
//
// Payments are not wired up: the app never charges anyone, and these limits are not enforced by
// the API. They are shown so a workspace can compare its real usage against what each plan includes.

import { CONTACT_EMAIL } from "@/components/marketing/site-config"

export type PlanId = "STARTER" | "PROFESSIONAL" | "BUSINESS" | "ENTERPRISE"

export interface Plan {
  id: PlanId
  name: string
  description: string
  /** USD per month */
  price: number
  teamSize: string
  /** null = unlimited */
  limits: { items: number | null; members: number | null }
  features: string[]
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "STARTER",
    name: "Starter",
    description: "Perfect for small teams getting started",
    price: 29,
    teamSize: "1–5 people",
    limits: { items: 500, members: 5 },
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
    id: "PROFESSIONAL",
    name: "Professional",
    description: "For growing businesses with more needs",
    price: 79,
    teamSize: "6–20 people",
    limits: { items: 5000, members: 20 },
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
    id: "BUSINESS",
    name: "Business",
    description: "Advanced features for larger operations",
    price: 149,
    teamSize: "21–50 people",
    limits: { items: 25000, members: 50 },
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
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    price: 299,
    teamSize: "51–100 people",
    limits: { items: null, members: 100 },
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

export function getPlan(id: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null
}

export function planRank(id: string | null | undefined): number {
  return PLANS.findIndex((p) => p.id === id)
}

/** Where plan-change requests go — the same contact address the public pricing page uses */
export const SALES_EMAIL = CONTACT_EMAIL
