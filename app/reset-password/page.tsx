"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Package, CheckCircle2 } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading || !token) return

    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    // TODO: Implement actual password reset
    setTimeout(() => {
      setSuccess(true)
      setLoading(false)
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-linear-to-br from-accent to-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              StockFlow
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/#about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="shadow-lg shadow-accent/20">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center p-4 py-16">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>{success ? "Password reset successful" : "Set new password"}</CardTitle>
              <CardDescription>
                {success ? "Your password has been updated" : "Enter your new password below"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center p-4 bg-green-500/10 rounded-lg">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Your password has been successfully reset. Redirecting to login...
                  </p>
                </div>
              ) : !token ? (
                <div className="space-y-4">
                  <p className="text-sm text-destructive text-center">
                    Invalid or missing reset token
                  </p>
                  <Link href="/forgot-password">
                    <Button variant="outline" className="w-full">
                      Request new reset link
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      minLength={8}
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Resetting password..." : "Reset password"}
                  </Button>
                </form>
              )}

              {!success && (
                <div className="mt-6 text-center">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                    Back to login
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}