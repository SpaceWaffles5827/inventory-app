import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm, type LoginNotice } from "@/components/auth/login-form"
import { getSafeNext, paramValue } from "@/components/auth/validation"

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to your StockFlow account.",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const rawNext = paramValue(params.next)

  let notice: LoginNotice = null
  if (paramValue(params.registered)) notice = "registered"
  else if (paramValue(params.reset)) notice = "reset"
  else if (paramValue(params.invited)) notice = "invited"
  else if (rawNext) notice = "expired"

  return (
    <AuthShell>
      <LoginForm next={getSafeNext(rawNext)} notice={notice} />
    </AuthShell>
  )
}
