import type { Metadata } from "next"
import { ContactEmailLink, LegalPage, type LegalSection } from "@/components/marketing/legal-page"

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How StockFlow uses cookies and similar technologies, and how you can control them.",
}

const SECTIONS: LegalSection[] = [
  {
    id: "what-are-cookies",
    title: "What Are Cookies",
    content: (
      <p>
        Cookies are small text files that are placed on your device when you visit our website. They help us provide you
        with a better experience by remembering your preferences and understanding how you use our Service.
      </p>
    ),
  },
  {
    id: "how-we-use-cookies",
    title: "How We Use Cookies",
    content: (
      <>
        <p>We use cookies for various purposes:</p>
        <h3>Essential Cookies</h3>
        <p>
          These cookies are necessary for the Service to function properly. They enable core functionality such as
          security, authentication, and accessibility features.
        </p>
        <h3>Preference Cookies</h3>
        <p>
          These cookies remember your preferences and settings, such as language preference, theme selection, and
          workspace settings.
        </p>
        <h3>Analytics Cookies</h3>
        <p>
          We use analytics cookies to understand how visitors interact with our Service. This helps us improve our
          features and user experience.
        </p>
        <h3>Marketing Cookies</h3>
        <p>
          These cookies track your online activity to help us deliver more relevant advertising and measure the
          effectiveness of our marketing campaigns.
        </p>
      </>
    ),
  },
  {
    id: "types-of-cookies",
    title: "Types of Cookies We Use",
    content: (
      <>
        <h3>Session Cookies</h3>
        <p>Temporary cookies that expire when you close your browser. Used for authentication and navigation.</p>
        <h3>Persistent Cookies</h3>
        <p>Remain on your device for a set period or until you delete them. Used to remember your preferences.</p>
        <h3>First-Party Cookies</h3>
        <p>Set directly by StockFlow to provide core functionality and improve your experience.</p>
        <h3>Third-Party Cookies</h3>
        <p>Set by our partners for analytics, advertising, and other services.</p>
      </>
    ),
  },
  {
    id: "third-party-cookies",
    title: "Third-Party Cookies",
    content: (
      <>
        <p>We work with third-party service providers who may set cookies on your device:</p>
        <ul>
          <li>Google Analytics - for website analytics and performance monitoring</li>
          <li>Stripe - for payment processing</li>
          <li>Intercom - for customer support and communication</li>
          <li>Social media platforms - for social sharing features</li>
        </ul>
      </>
    ),
  },
  {
    id: "managing-cookies",
    title: "Managing Cookies",
    content: (
      <>
        <p>You have the right to accept or reject cookies. You can manage your cookie preferences through:</p>
        <ul>
          <li>Your browser settings - most browsers allow you to refuse or delete cookies</li>
          <li>Our cookie consent banner when you first visit our website</li>
          <li>Your account settings for preference cookies</li>
        </ul>
        <p>
          Please note that blocking certain cookies may impact your experience and some features may not function
          properly.
        </p>
      </>
    ),
  },
  {
    id: "browser-controls",
    title: "Browser Controls",
    content: (
      <>
        <p>Most web browsers allow you to control cookies through their settings:</p>
        <ul>
          <li>Chrome: Settings → Privacy and security → Cookies and other site data</li>
          <li>Firefox: Settings → Privacy &amp; Security → Cookies and Site Data</li>
          <li>Safari: Preferences → Privacy → Cookies and website data</li>
          <li>Edge: Settings → Cookies and site permissions → Cookies and site data</li>
        </ul>
      </>
    ),
  },
  {
    id: "do-not-track",
    title: "Do Not Track",
    content: (
      <p>
        Some browsers include a &quot;Do Not Track&quot; (DNT) feature. Currently, there is no industry standard for how
        to respond to DNT signals. We do not currently respond to DNT signals, but we respect your privacy choices and
        provide cookie management options.
      </p>
    ),
  },
  {
    id: "updates",
    title: "Updates to This Policy",
    content: (
      <p>
        We may update this Cookie Policy from time to time to reflect changes in our practices or for legal reasons. We
        will notify you of any significant changes by posting the updated policy on our website.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact Us",
    content: (
      <p>
        If you have questions about our use of cookies, please contact us at <ContactEmailLink />.
      </p>
    ),
  },
]

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      summary="How StockFlow uses cookies and similar technologies, and how you can control them."
      href="/cookies"
      sections={SECTIONS}
    />
  )
}
