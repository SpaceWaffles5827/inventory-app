import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Check, ArrowRight, Zap } from "lucide-react"

export default function PricingPage() {
  const plans = [
    {
      name: "Starter",
      description: "Perfect for small teams getting started",
      price: "$29",
      teamSize: "1-5 people",
      features: [
        "Up to 500 items",
        "Basic analytics",
        "Email support",
        "1 warehouse location",
        "Mobile app access",
        "Basic reporting",
      ],
      popular: false,
    },
    {
      name: "Professional",
      description: "For growing businesses with more needs",
      price: "$79",
      teamSize: "6-20 people",
      features: [
        "Up to 5,000 items",
        "Advanced analytics",
        "Priority support",
        "5 warehouse locations",
        "Mobile app access",
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
      teamSize: "21-50 people",
      features: [
        "Up to 25,000 items",
        "Real-time analytics",
        "24/7 phone support",
        "Unlimited locations",
        "Mobile app access",
        "Custom reporting",
        "Full API access",
        "Advanced integrations",
        "Dedicated account manager",
      ],
      popular: false,
    },
    {
      name: "Enterprise",
      description: "Custom solutions for large organizations",
      price: "$299",
      teamSize: "51-100 people",
      features: [
        "Unlimited items",
        "Enterprise analytics",
        "24/7 priority support",
        "Unlimited locations",
        "Mobile app access",
        "Custom reporting",
        "Full API access",
        "Custom integrations",
        "Dedicated success team",
        "SLA guarantee",
        "Custom training",
      ],
      popular: false,
    },
  ]

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-linear-to-br from-accent to-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              StockFlow
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-foreground">
              Pricing
            </Link>
            <Link
              href="/#about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="shadow-lg shadow-accent/20">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Simple, transparent pricing</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
            Choose the perfect plan for your{" "}
            <span className="bg-linear-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
              business
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 text-pretty leading-relaxed max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative border-border/50 hover:border-accent/50 transition-all hover:shadow-xl ${plan.popular ? "border-accent/50 shadow-xl shadow-accent/10 scale-105" : ""
                }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-linear-to-r from-accent to-primary text-accent-foreground text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg">
                    Most Popular
                  </div>
                </div>
              )}
              <CardHeader className="pb-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.teamSize}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Link href="/signup">
                  <Button className="w-full gap-2" variant={plan.popular ? "default" : "outline"}>
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center flex-0 mt-0.5">
                        <Check className="h-3 w-3 text-accent" />
                      </div>
                      <span className="text-sm text-muted-foreground leading-relaxed">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enterprise Contact */}
        <div className="max-w-4xl mx-auto mt-16">
          <Card className="border-border/50 bg-linear-to-br from-accent/5 via-primary/5 to-accent/5">
            <CardContent className="p-8 md:p-12 text-center">
              <h3 className="text-3xl font-bold text-foreground mb-4">Need more than 100 people?</h3>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                Contact our sales team for custom enterprise pricing and features tailored to your organization&apos;s needs.
              </p>
              <Button size="lg" className="gap-2">
                Contact Sales
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans later?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next
                  billing cycle.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We accept all major credit cards (Visa, MasterCard, American Express) and offer annual billing with a
                  discount.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Is there a free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! All plans come with a 14-day free trial. No credit card required to start.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-linear-to-br from-accent to-primary flex items-center justify-center">
                <Package className="h-4 w-4 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">© 2025 StockFlow. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-8">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
