import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a link to reset your StockFlow password.",
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  )
}
