import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Package,
  BarChart3,
  Users,
  TrendingUp,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  Warehouse,
  Boxes,
  MapPin,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-linear-to-br from-primary via-accent to-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">StockFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              How it works
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-foreground/70 cursor-pointer">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90 shadow-lg cursor-pointer">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-32 md:pt-32 md:pb-48">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-foreground/10 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-sm font-medium text-foreground">New: Real-time inventory sync</span>
            </div>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold text-foreground mb-8 text-center text-balance leading-[0.95]">
            Warehouse control
            <br />
            <span className="text-foreground/40">made effortless</span>
          </h1>

          <p className="text-xl md:text-2xl text-foreground/60 mb-12 text-center text-pretty leading-relaxed max-w-3xl mx-auto">
            The complete platform for small businesses to track inventory, manage locations, and scale operations with
            confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-12 bg-foreground text-background hover:bg-foreground/90 shadow-xl"
              >
                Get started—it&apos;s free
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto text-base px-8 h-12 border-foreground/20 hover:bg-foreground/5 bg-transparent"
              >
                See how it works
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto pt-12 border-t border-foreground/10">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">98%</div>
              <div className="text-sm text-foreground/60">Accuracy rate</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">2.5hrs</div>
              <div className="text-sm text-foreground/60">Saved daily</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">500+</div>
              <div className="text-sm text-foreground/60">Businesses</div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 border-y border-foreground/10 bg-foreground/[0.02]">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-foreground/50 mb-8 uppercase tracking-wider font-medium">
            Trusted by leading warehouses
          </p>
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16 opacity-50">
            <div className="text-2xl font-bold text-foreground">ACME Corp</div>
            <div className="text-2xl font-bold text-foreground">Warehouse Pro</div>
            <div className="text-2xl font-bold text-foreground">LogiTech</div>
            <div className="text-2xl font-bold text-foreground">StockMaster</div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center mb-32">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/5 border border-foreground/10 mb-6">
                  <Warehouse className="h-4 w-4 text-foreground/70" />
                  <span className="text-sm font-medium text-foreground/70">Organization</span>
                </div>
                <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
                  Track every item, everywhere
                </h2>
                <p className="text-lg text-foreground/60 mb-8 leading-relaxed">
                  Know exactly where your inventory is stored with our intelligent location management system. From
                  zones to bins, track it all.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-foreground mt-0.5 flex-0" />
                    <span className="text-foreground/80">
                      Multi-level location hierarchy (Zone → Aisle → Shelf → Bin)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-foreground mt-0.5 flex-0" />
                    <span className="text-foreground/80">Real-time capacity tracking and utilization metrics</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-foreground mt-0.5 flex-0" />
                    <span className="text-foreground/80">Quick search and filter to find items instantly</span>
                  </li>
                </ul>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-3xl bg-linear-to-br from-foreground/5 to-foreground/10 border border-foreground/10 p-8 flex items-center justify-center">
                  <MapPin className="h-32 w-32 text-foreground/20" />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="order-2 md:order-1 relative">
                <div className="aspect-square rounded-3xl bg-linear-to-br from-foreground/5 to-foreground/10 border border-foreground/10 p-8 flex items-center justify-center">
                  <Boxes className="h-32 w-32 text-foreground/20" />
                </div>
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/5 border border-foreground/10 mb-6">
                  <TrendingUp className="h-4 w-4 text-foreground/70" />
                  <span className="text-sm font-medium text-foreground/70">Efficiency</span>
                </div>
                <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
                  Professional stock adjustments
                </h2>
                <p className="text-lg text-foreground/60 mb-8 leading-relaxed">
                  Track every input and output with detailed transaction logs. Perfect for warehouse audits and
                  compliance.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-foreground mt-0.5 flex-0" />
                    <span className="text-foreground/80">Formal adjustment process with reason tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-foreground mt-0.5 flex-0" />
                    <span className="text-foreground/80">Complete action history for every item</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-foreground mt-0.5 flex-0" />
                    <span className="text-foreground/80">Audit-ready reports and transaction logs</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-foreground/[0.02]">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance">Everything you need</h2>
              <p className="text-xl text-foreground/60 max-w-2xl mx-auto text-pretty">
                Powerful features designed specifically for warehouse and inventory management.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-foreground/10 bg-background hover:border-foreground/20 transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="h-12 w-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-6 group-hover:bg-foreground/10 transition-colors">
                    <Package className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Item Management</h3>
                  <p className="text-foreground/60 leading-relaxed">
                    Track items with barcodes, categories, suppliers, and detailed specifications.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-foreground/10 bg-background hover:border-foreground/20 transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="h-12 w-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-6 group-hover:bg-foreground/10 transition-colors">
                    <MapPin className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Location Tracking</h3>
                  <p className="text-foreground/60 leading-relaxed">
                    Organize your warehouse with zones, aisles, shelves, and bins for easy navigation.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-foreground/10 bg-background hover:border-foreground/20 transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="h-12 w-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-6 group-hover:bg-foreground/10 transition-colors">
                    <BarChart3 className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Analytics Dashboard</h3>
                  <p className="text-foreground/60 leading-relaxed">
                    Visualize trends, track performance, and make data-driven inventory decisions.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-foreground/10 bg-background hover:border-foreground/20 transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="h-12 w-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-6 group-hover:bg-foreground/10 transition-colors">
                    <Users className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Team Workspaces</h3>
                  <p className="text-foreground/60 leading-relaxed">
                    Collaborate with your team using role-based permissions and access control.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-foreground/10 bg-background hover:border-foreground/20 transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="h-12 w-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-6 group-hover:bg-foreground/10 transition-colors">
                    <Zap className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Lightning Fast</h3>
                  <p className="text-foreground/60 leading-relaxed">
                    Built for speed with instant search, real-time updates, and seamless performance.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-foreground/10 bg-background hover:border-foreground/20 transition-all group">
                <CardContent className="pt-8 pb-8">
                  <div className="h-12 w-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-6 group-hover:bg-foreground/10 transition-colors">
                    <Shield className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Secure & Compliant</h3>
                  <p className="text-foreground/60 leading-relaxed">
                    Enterprise-grade security with complete audit trails and compliance-ready reports.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
              Start managing inventory the modern way
            </h2>
            <p className="text-xl text-foreground/60 mb-10 text-pretty max-w-2xl mx-auto">
              Join hundreds of warehouses already using StockFlow to streamline operations and reduce errors.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="text-base px-10 h-14 bg-foreground text-background hover:bg-foreground/90 shadow-xl"
              >
                Get started for free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-sm text-foreground/50 mt-6">No credit card required • Free 14-day trial</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-foreground/10 bg-foreground/[0.02]">
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-xl bg-linear-to-br from-primary via-accent to-primary flex items-center justify-center shadow-lg shadow-primary/20">
                  <Package className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">StockFlow</span>
              </div>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Modern inventory management for small businesses and warehouses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="#features" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="#how-it-works"
                    className="text-sm text-foreground/60 hover:text-foreground transition-colors"
                  >
                    How it works
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="#" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/privacy" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link href="/gdpr" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
                    GDPR
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-foreground/10">
            <p className="text-sm text-foreground/50 text-center">© 2025 StockFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
