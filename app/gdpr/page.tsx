import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Package, ArrowLeft } from "lucide-react"

export default function GDPRPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-linear-to-r from-accent to-primary flex items-center justify-center">
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
        <h1 className="text-4xl md:text-5xl font-bold mb-4">GDPR Compliance</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 26, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              StockFlow is committed to protecting your personal data and respecting your privacy rights under the
              General Data Protection Regulation (GDPR). This page explains how we comply with GDPR requirements and
              your rights as a data subject.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Legal Basis for Processing</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We process your personal data under the following legal bases:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>
                <strong>Contract Performance:</strong> Processing necessary to provide our Service to you
              </li>
              <li>
                <strong>Legitimate Interest:</strong> For improving our Service, security, and fraud prevention
              </li>
              <li>
                <strong>Consent:</strong> For marketing communications and optional features
              </li>
              <li>
                <strong>Legal Obligation:</strong> When required by law
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Your GDPR Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Under GDPR, you have the following rights:</p>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Right to Access</h4>
                <p className="text-muted-foreground leading-relaxed">
                  You can request a copy of all personal data we hold about you.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Right to Rectification</h4>
                <p className="text-muted-foreground leading-relaxed">
                  You can request correction of inaccurate or incomplete personal data.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Right to Erasure (&ldquo;Right to be Forgotten&rdquo;)</h4>
                <p className="text-muted-foreground leading-relaxed">
                  You can request deletion of your personal data in certain circumstances.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Right to Restrict Processing</h4>
                <p className="text-muted-foreground leading-relaxed">
                  You can request that we limit how we use your personal data.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Right to Data Portability</h4>
                <p className="text-muted-foreground leading-relaxed">
                  You can request your data in a structured, machine-readable format.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Right to Object</h4>
                <p className="text-muted-foreground leading-relaxed">
                  You can object to processing based on legitimate interests or for direct marketing.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Rights Related to Automated Decision-Making</h4>
                <p className="text-muted-foreground leading-relaxed">
                  You have rights regarding automated decisions that significantly affect you.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. How to Exercise Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">To exercise any of your GDPR rights, you can:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Email us at gdpr@stockflow.com</li>
              <li>Use the data management tools in your account settings</li>
              <li>Contact our Data Protection Officer directly</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We will respond to your request within 30 days. In some cases, we may need to verify your identity before
              processing your request.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Protection Officer</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Data Protection Officer (DPO) is responsible for overseeing our data protection strategy and GDPR
              compliance. You can contact our DPO at:
            </p>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">
                Email: dpo@stockflow.com
                <br />
                Address: StockFlow Data Protection Officer, 123 Main St, San Francisco, CA 94102
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              When we transfer your data outside the European Economic Area (EEA), we ensure appropriate safeguards are
              in place, such as Standard Contractual Clauses approved by the European Commission or transfers to
              countries with adequacy decisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal data only for as long as necessary to fulfill the purposes for which it was
              collected, including legal, accounting, or reporting requirements. When data is no longer needed, we
              securely delete or anonymize it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement appropriate technical and organizational measures to protect your personal data, including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments and audits</li>
              <li>Access controls and authentication</li>
              <li>Employee training on data protection</li>
              <li>Incident response procedures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Data Breach Notification</h2>
            <p className="text-muted-foreground leading-relaxed">
              In the event of a data breach that poses a risk to your rights and freedoms, we will notify you and the
              relevant supervisory authority within 72 hours of becoming aware of the breach, as required by GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Children&apos;s Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not directed to children under 16. We do not knowingly collect personal data from children
              under 16. If we become aware that we have collected data from a child under 16, we will take steps to
              delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Right to Lodge a Complaint</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you believe we have not handled your personal data in accordance with GDPR, you have the right to lodge
              a complaint with your local supervisory authority. However, we encourage you to contact us first so we can
              address your concerns.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Updates to This Page</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this GDPR compliance page from time to time. We will notify you of any material changes and
              update the &quot;Last updated&quot; date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any questions about GDPR compliance or to exercise your rights, please contact us at
              gdpr@stockflow.com
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
