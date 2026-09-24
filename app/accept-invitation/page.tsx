import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { AcceptInvitationView } from "@/components/auth/accept-invitation-view"
import { paramValue } from "@/components/auth/validation"

export const metadata: Metadata = {
  title: "Accept invitation",
  description: "Join your team's StockFlow workspace.",
  robots: { index: false },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Invitation links look like /accept-invitation?token=…&email=…
export default async function AcceptInvitationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const token = paramValue(params.token)?.trim() || null
  const email = paramValue(params.email)?.trim() || null

  return (
    <AuthShell>
      <AcceptInvitationView token={token} email={email} />
    </AuthShell>
  )
}
