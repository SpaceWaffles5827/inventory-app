import type { Metadata } from "next"
import { ContactEmailLink, LegalPage, type LegalSection } from "@/components/marketing/legal-page"

export const metadata: Metadata = {
  title: "GDPR Compliance",
  description: "How StockFlow complies with the General Data Protection Regulation and how to exercise your rights.",
}

const RIGHTS: { title: string; description: string }[] = [
  { title: "Right to Access", description: "You can request a copy of all personal data we hold about you." },
  {
    title: "Right to Rectification",
    description: "You can request correction of inaccurate or incomplete personal data.",
  },
  {
    title: "Right to Erasure (“Right to be Forgotten”)",
    description: "You can request deletion of your personal data in certain circumstances.",
  },
  { title: "Right to Restrict Processing", description: "You can request that we limit how we use your personal data." },
  {
    title: "Right to Data Portability",
    description: "You can request your data in a structured, machine-readable format.",
  },
  {
    title: "Right to Object",
    description: "You can object to processing based on legitimate interests or for direct marketing.",
  },
  {
    title: "Rights Related to Automated Decision-Making",
    description: "You have rights regarding automated decisions that significantly affect you.",
  },
]

const SECTIONS: LegalSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    content: (
      <p>
        StockFlow is committed to protecting your personal data and respecting your privacy rights under the General Data
        Protection Regulation (GDPR). This page explains how we comply with GDPR requirements and your rights as a data
        subject.
      </p>
    ),
  },
  {
    id: "legal-basis",
    title: "Legal Basis for Processing",
    content: (
      <>
        <p>We process your personal data under the following legal bases:</p>
        <ul>
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
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your GDPR Rights",
    content: (
      <>
        <p>Under GDPR, you have the following rights:</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {RIGHTS.map((right) => (
            <div key={right.title} className="rounded-xl border bg-card p-4">
              <dt className="font-semibold text-foreground">{right.title}</dt>
              <dd className="mt-1 text-sm leading-6">{right.description}</dd>
            </div>
          ))}
        </dl>
      </>
    ),
  },
  {
    id: "exercising-rights",
    title: "How to Exercise Your Rights",
    content: (
      <>
        <p>To exercise any of your GDPR rights, you can:</p>
        <ul>
          <li>
            Email us at <ContactEmailLink />
          </li>
          <li>Use the data management tools in your account settings</li>
          <li>Contact our Data Protection Officer directly</li>
        </ul>
        <p>
          We will respond to your request within 30 days. In some cases, we may need to verify your identity before
          processing your request.
        </p>
      </>
    ),
  },
  {
    id: "dpo",
    title: "Data Protection Officer",
    content: (
      <p>
        Our Data Protection Officer (DPO) is responsible for overseeing our data protection strategy and GDPR compliance.
        You can contact our DPO at <ContactEmailLink />.
      </p>
    ),
  },
  {
    id: "transfers",
    title: "Data Transfers",
    content: (
      <p>
        When we transfer your data outside the European Economic Area (EEA), we ensure appropriate safeguards are in
        place, such as Standard Contractual Clauses approved by the European Commission or transfers to countries with
        adequacy decisions.
      </p>
    ),
  },
  {
    id: "retention",
    title: "Data Retention",
    content: (
      <p>
        We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected,
        including legal, accounting, or reporting requirements. When data is no longer needed, we securely delete or
        anonymize it.
      </p>
    ),
  },
  {
    id: "security",
    title: "Data Security",
    content: (
      <>
        <p>
          We implement appropriate technical and organizational measures to protect your personal data, including:
        </p>
        <ul>
          <li>Encryption of data in transit and at rest</li>
          <li>Regular security assessments and audits</li>
          <li>Access controls and authentication</li>
          <li>Employee training on data protection</li>
          <li>Incident response procedures</li>
        </ul>
      </>
    ),
  },
  {
    id: "breach-notification",
    title: "Data Breach Notification",
    content: (
      <p>
        In the event of a data breach that poses a risk to your rights and freedoms, we will notify you and the relevant
        supervisory authority within 72 hours of becoming aware of the breach, as required by GDPR.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children's Data",
    content: (
      <p>
        Our Service is not directed to children under 16. We do not knowingly collect personal data from children under
        16. If we become aware that we have collected data from a child under 16, we will take steps to delete it
        promptly.
      </p>
    ),
  },
  {
    id: "complaints",
    title: "Right to Lodge a Complaint",
    content: (
      <p>
        If you believe we have not handled your personal data in accordance with GDPR, you have the right to lodge a
        complaint with your local supervisory authority. However, we encourage you to contact us first so we can address
        your concerns.
      </p>
    ),
  },
  {
    id: "updates",
    title: "Updates to This Page",
    content: (
      <p>
        We may update this GDPR compliance page from time to time. We will notify you of any material changes and update
        the &quot;Last updated&quot; date at the top of this page.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact Information",
    content: (
      <p>
        For any questions about GDPR compliance or to exercise your rights, please contact us at <ContactEmailLink />.
      </p>
    ),
  },
]

export default function GDPRPage() {
  return (
    <LegalPage
      title="GDPR Compliance"
      summary="How StockFlow protects your personal data under the General Data Protection Regulation, and how to exercise your rights."
      href="/gdpr"
      sections={SECTIONS}
    />
  )
}
