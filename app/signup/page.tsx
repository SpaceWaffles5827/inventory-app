import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a StockFlow account and start your 14-day free trial. No credit card required.",
}

export default function SignupPage() {
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  )
}
