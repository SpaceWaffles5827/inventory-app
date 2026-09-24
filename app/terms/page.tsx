import type { Metadata } from "next"
import { ContactEmailLink, LegalPage, type LegalSection } from "@/components/marketing/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of StockFlow.",
}

const SECTIONS: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    content: (
      <p>
        By accessing and using StockFlow (&quot;the Service&quot;), you accept and agree to be bound by the terms and
        provision of this agreement. If you do not agree to these Terms of Service, please do not use the Service.
      </p>
    ),
  },
  {
    id: "description",
    title: "Description of Service",
    content: (
      <p>
        StockFlow provides cloud-based inventory management software designed for small to medium-sized businesses. The
        Service includes features for tracking inventory, managing stock levels, generating reports, and collaborating
        with team members.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "User Accounts",
    content: (
      <>
        <p>To use certain features of the Service, you must register for an account. You agree to:</p>
        <ul>
          <li>Provide accurate, current, and complete information during registration</li>
          <li>Maintain and promptly update your account information</li>
          <li>Maintain the security of your password and account</li>
          <li>Accept responsibility for all activities that occur under your account</li>
          <li>Notify us immediately of any unauthorized use of your account</li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any illegal purpose or in violation of any laws</li>
          <li>Attempt to gain unauthorized access to the Service or related systems</li>
          <li>Interfere with or disrupt the Service or servers</li>
          <li>Upload or transmit viruses or malicious code</li>
          <li>Collect or harvest any information from the Service</li>
          <li>Use the Service to send spam or unsolicited messages</li>
        </ul>
      </>
    ),
  },
  {
    id: "subscription",
    title: "Subscription and Payment",
    content: (
      <p>
        Some features of the Service require a paid subscription. You agree to pay all fees associated with your
        subscription plan. Subscriptions automatically renew unless cancelled before the renewal date. We reserve the
        right to change our pricing with 30 days notice.
      </p>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
    content: (
      <p>
        The Service and its original content, features, and functionality are owned by StockFlow and are protected by
        international copyright, trademark, patent, trade secret, and other intellectual property laws. You retain
        ownership of any data you upload to the Service.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Termination",
    content: (
      <p>
        We may terminate or suspend your account and access to the Service immediately, without prior notice, for any
        reason, including breach of these Terms. Upon termination, your right to use the Service will immediately cease.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    content: (
      <p>
        StockFlow shall not be liable for any indirect, incidental, special, consequential, or punitive damages
        resulting from your use of or inability to use the Service. Our total liability shall not exceed the amount you
        paid for the Service in the past 12 months.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to Terms",
    content: (
      <p>
        We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or
        through the Service. Your continued use of the Service after such modifications constitutes your acceptance of
        the updated Terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact Information",
    content: (
      <p>
        If you have any questions about these Terms, please contact us at <ContactEmailLink />.
      </p>
    ),
  },
]

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="The agreement between you and StockFlow when you use the Service."
      href="/terms"
      sections={SECTIONS}
    />
  )
}
