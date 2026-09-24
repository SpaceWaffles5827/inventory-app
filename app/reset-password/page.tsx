import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { paramValue } from "@/components/auth/validation"

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your StockFlow account.",
  robots: { index: false },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const token = paramValue(params.token)?.trim() || null

  return (
    <AuthShell>
      <ResetPasswordForm token={token} />
    </AuthShell>
  )
}
