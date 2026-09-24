import type { Metadata } from "next"
import Link from "next/link"
import { ContactEmailLink, LegalPage, type LegalSection } from "@/components/marketing/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How StockFlow collects, uses, and protects your information.",
}

const SECTIONS: LegalSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    content: (
      <p>
        StockFlow (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This
        Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our inventory
        management service.
      </p>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information We Collect",
    content: (
      <>
        <h3>Personal Information</h3>
        <p>We collect information that you provide directly to us, including:</p>
        <ul>
          <li>Name, email address, and phone number</li>
          <li>Company name and business information</li>
          <li>Payment and billing information</li>
          <li>Profile information and preferences</li>
        </ul>
        <h3>Usage Information</h3>
        <p>We automatically collect:</p>
        <ul>
          <li>Log data (IP address, browser type, pages visited)</li>
          <li>Device information</li>
          <li>Usage patterns and preferences</li>
          <li>Cookies and similar tracking technologies</li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How We Use Your Information",
    content: (
      <>
        <p>We use your information to:</p>
        <ul>
          <li>Provide, maintain, and improve our Service</li>
          <li>Process transactions and send related information</li>
          <li>Send technical notices and support messages</li>
          <li>Respond to your comments and questions</li>
          <li>Send marketing communications (with your consent)</li>
          <li>Monitor and analyze trends and usage</li>
          <li>Detect and prevent fraud and abuse</li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Information Sharing",
    content: (
      <>
        <p>We may share your information with:</p>
        <ul>
          <li>Service providers who assist in operating our Service</li>
          <li>Business partners with your consent</li>
          <li>Law enforcement when required by law</li>
          <li>Other parties in connection with a merger or acquisition</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Data Security",
    content: (
      <p>
        We implement appropriate technical and organizational measures to protect your information against unauthorized
        access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100%
        secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    id: "retention",
    title: "Data Retention",
    content: (
      <p>
        We retain your information for as long as necessary to provide the Service and fulfill the purposes outlined in
        this Privacy Policy. When you delete your account, we will delete or anonymize your information within 90 days,
        except where we are required to retain it by law.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your Rights",
    content: (
      <>
        <p>You have the right to:</p>
        <ul>
          <li>Access and receive a copy of your personal information</li>
          <li>Correct inaccurate or incomplete information</li>
          <li>Request deletion of your information</li>
          <li>Object to or restrict processing of your information</li>
          <li>Data portability</li>
          <li>Withdraw consent at any time</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    content: (
      <p>
        We use cookies and similar tracking technologies to track activity on our Service. You can instruct your browser
        to refuse all cookies or indicate when a cookie is being sent. See our <Link href="/cookies">Cookie Policy</Link>{" "}
        for more details.
      </p>
    ),
  },
  {
    id: "international-transfers",
    title: "International Data Transfers",
    content: (
      <p>
        Your information may be transferred to and processed in countries other than your own. We ensure appropriate
        safeguards are in place to protect your information in accordance with this Privacy Policy.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children's Privacy",
    content: (
      <p>
        Our Service is not intended for children under 13. We do not knowingly collect personal information from
        children under 13. If you become aware that a child has provided us with personal information, please contact us.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: (
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy
        Policy on this page and updating the &quot;Last updated&quot; date.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact Us",
    content: (
      <p>
        If you have questions about this Privacy Policy, please contact us at <ContactEmailLink />.
      </p>
    ),
  },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="What information we collect when you use StockFlow, how we use it, and the choices you have."
      href="/privacy"
      sections={SECTIONS}
    />
  )
}
