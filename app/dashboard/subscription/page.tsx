"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  CreditCard,
  Calendar,
  Users,
  Package,
  TrendingUp,
  Check,
  ArrowRight,
  Download,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

export default function SubscriptionPage() {
  const [currentPlan] = useState({
    name: "Professional",
    price: 79,
    teamSize: "6-20 people",
    billingCycle: "Monthly",
    nextBillingDate: "February 15, 2025",
    currentUsers: 12,
    maxUsers: 20,
    currentItems: 3240,
    maxItems: 5000,
    currentLocations: 3,
    maxLocations: 5,
  })

  const availablePlans = [
    {
      name: "Starter",
      price: 29,
      teamSize: "1-5 people",
      features: ["Up to 500 items", "Basic analytics", "Email support", "1 warehouse location"],
      current: false,
    },
    {
      name: "Professional",
      price: 79,
      teamSize: "6-20 people",
      features: ["Up to 5,000 items", "Advanced analytics", "Priority support", "5 warehouse locations"],
      current: true,
    },
    {
      name: "Business",
      price: 149,
      teamSize: "21-50 people",
      features: ["Up to 25,000 items", "Real-time analytics", "24/7 support", "Unlimited locations"],
      current: false,
    },
    {
      name: "Enterprise",
      price: 299,
      teamSize: "51-100 people",
      features: ["Unlimited items", "Enterprise analytics", "Dedicated support", "Custom integrations"],
      current: false,
    },
  ]

  const invoices = [
    { id: "INV-2025-001", date: "Jan 15, 2025", amount: 79, status: "Paid" },
    { id: "INV-2024-012", date: "Dec 15, 2024", amount: 79, status: "Paid" },
    { id: "INV-2024-011", date: "Nov 15, 2024", amount: 79, status: "Paid" },
    { id: "INV-2024-010", date: "Oct 15, 2024", amount: 79, status: "Paid" },
  ]

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-8 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Subscription
          </h1>
          <p className="text-muted-foreground mt-2">Manage your subscription and billing</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Current Plan & Usage */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Plan */}
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-2xl">{currentPlan.name} Plan</CardTitle>
                      <Badge className="bg-accent/10 text-accent hover:bg-accent/20">Active</Badge>
                    </div>
                    <CardDescription>Your current subscription plan</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-foreground">${currentPlan.price}</div>
                    <div className="text-sm text-muted-foreground">per month</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Next billing date</div>
                      <div className="font-semibold">{currentPlan.nextBillingDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Billing cycle</div>
                      <div className="font-semibold">{currentPlan.billingCycle}</div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    Usage Overview
                  </h4>

                  {/* Users Usage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Team Members
                      </span>
                      <span className="font-medium">
                        {currentPlan.currentUsers} / {currentPlan.maxUsers}
                      </span>
                    </div>
                    <Progress value={(currentPlan.currentUsers / currentPlan.maxUsers) * 100} className="h-2" />
                  </div>

                  {/* Items Usage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Inventory Items
                      </span>
                      <span className="font-medium">
                        {currentPlan.currentItems.toLocaleString()} / {currentPlan.maxItems.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={(currentPlan.currentItems / currentPlan.maxItems) * 100} className="h-2" />
                  </div>

                  {/* Locations Usage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Warehouse Locations
                      </span>
                      <span className="font-medium">
                        {currentPlan.currentLocations} / {currentPlan.maxLocations}
                      </span>
                    </div>
                    <Progress value={(currentPlan.currentLocations / currentPlan.maxLocations) * 100} className="h-2" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1 bg-transparent">
                    Change Plan
                  </Button>
                  <Button variant="outline" className="flex-1 text-destructive hover:text-destructive bg-transparent">
                    Cancel Subscription
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Available Plans */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Available Plans</CardTitle>
                <CardDescription>Upgrade or downgrade your plan anytime</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {availablePlans.map((plan) => (
                    <Card
                      key={plan.name}
                      className={`border-border/50 ${plan.current ? "border-accent/50 bg-accent/5" : ""}`}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-lg">{plan.name}</h4>
                            <p className="text-xs text-muted-foreground">{plan.teamSize}</p>
                          </div>
                          {plan.current && (
                            <Badge className="bg-accent/10 text-accent hover:bg-accent/20">Current</Badge>
                          )}
                        </div>
                        <div className="mb-4">
                          <span className="text-2xl font-bold">${plan.price}</span>
                          <span className="text-muted-foreground text-sm">/month</span>
                        </div>
                        <ul className="space-y-2 mb-4">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm">
                              <Check className="h-4 w-4 text-accent flex-0 mt-0.5" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {!plan.current && (
                          <Button className="w-full gap-2 bg-transparent" variant="outline">
                            {plan.price > currentPlan.price ? "Upgrade" : "Downgrade"}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="mt-6 p-4 rounded-lg bg-muted/30 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-accent flex-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Need more than 100 people?</p>
                    <p className="text-muted-foreground">
                      Contact our sales team for custom enterprise pricing.{" "}
                      <Link href="/pricing" className="text-accent hover:underline">
                        Learn more
                      </Link>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payment & Invoices */}
          <div className="space-y-6">
            {/* Payment Method */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">•••• •••• •••• 4242</span>
                    <Badge variant="outline">Default</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">Expires 12/2026</div>
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  Update Payment Method
                </Button>
              </CardContent>
            </Card>

            {/* Billing History */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Billing History</CardTitle>
                <CardDescription>Your recent invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                      <div>
                        <div className="font-medium text-sm">{invoice.id}</div>
                        <div className="text-xs text-muted-foreground">{invoice.date}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-semibold">${invoice.amount}</div>
                          <Badge variant="outline" className="text-xs">
                            {invoice.status}
                          </Badge>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4 bg-transparent">
                  View All Invoices
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
