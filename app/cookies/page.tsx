import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Package, ArrowLeft } from "lucide-react"

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen">
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
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Cookie Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 26, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. What Are Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cookies are small text files that are placed on your device when you visit our website. They help us
              provide you with a better experience by remembering your preferences and understanding how you use our
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We use cookies for various purposes:</p>

            <h3 className="text-xl font-semibold mb-3 mt-4">Essential Cookies</h3>
            <p className="text-muted-foreground leading-relaxed">
              These cookies are necessary for the Service to function properly. They enable core functionality such as
              security, authentication, and accessibility features.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Preference Cookies</h3>
            <p className="text-muted-foreground leading-relaxed">
              These cookies remember your preferences and settings, such as language preference, theme selection, and
              workspace settings.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Analytics Cookies</h3>
            <p className="text-muted-foreground leading-relaxed">
              We use analytics cookies to understand how visitors interact with our Service. This helps us improve our
              features and user experience.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">Marketing Cookies</h3>
            <p className="text-muted-foreground leading-relaxed">
              These cookies track your online activity to help us deliver more relevant advertising and measure the
              effectiveness of our marketing campaigns.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Types of Cookies We Use</h2>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Session Cookies</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Temporary cookies that expire when you close your browser. Used for authentication and navigation.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Persistent Cookies</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Remain on your device for a set period or until you delete them. Used to remember your preferences.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">First-Party Cookies</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Set directly by StockFlow to provide core functionality and improve your experience.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Third-Party Cookies</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Set by our partners for analytics, advertising, and other services.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Third-Party Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We work with third-party service providers who may set cookies on your device:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Google Analytics - for website analytics and performance monitoring</li>
              <li>Stripe - for payment processing</li>
              <li>Intercom - for customer support and communication</li>
              <li>Social media platforms - for social sharing features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Managing Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You have the right to accept or reject cookies. You can manage your cookie preferences through:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Your browser settings - most browsers allow you to refuse or delete cookies</li>
              <li>Our cookie consent banner when you first visit our website</li>
              <li>Your account settings for preference cookies</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Please note that blocking certain cookies may impact your experience and some features may not function
              properly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Browser Controls</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Most web browsers allow you to control cookies through their settings:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Chrome: Settings → Privacy and security → Cookies and other site data</li>
              <li>Firefox: Settings → Privacy & Security → Cookies and Site Data</li>
              <li>Safari: Preferences → Privacy → Cookies and website data</li>
              <li>Edge: Settings → Cookies and site permissions → Cookies and site data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Do Not Track</h2>
            <p className="text-muted-foreground leading-relaxed">
              Some browsers include a &quot;Do Not Track&quot; (DNT) feature. Currently, there is no industry standard for how to
              respond to DNT signals. We do not currently respond to DNT signals, but we respect your privacy choices
              and provide cookie management options.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Updates to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in our practices or for legal
              reasons. We will notify you of any significant changes by posting the updated policy on our website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about our use of cookies, please contact us at privacy@stockflow.com
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
