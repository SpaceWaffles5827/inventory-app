"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Mail,
    Building2,
    Shield,
    ArrowRight,
    AlertCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { verifyInvitationApi, acceptInvitationApi, type InvitationWithWorkspace } from "@/lib/api/invitations.api"

function AcceptInvitationContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [accepting, setAccepting] = useState(false)
    const [invitation, setInvitation] = useState<InvitationWithWorkspace | null>(null)
    const [error, setError] = useState<string>("")
    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isExistingUser, setIsExistingUser] = useState(false)

    const token = searchParams.get("token")
    const email = searchParams.get("email")

    useEffect(() => {
        const verifyInvitation = async () => {
            try {
                setLoading(true)
                const result = await verifyInvitationApi({
                    token: token!,
                    email: email!
                })

                if (result.data) {
                    setInvitation(result.data.invitation || null)
                    setIsExistingUser(result.data.isExistingUser || false)
                }
            } catch (err) {
                console.error("Failed to verify invitation:", err)
                setError(err instanceof Error ? err.message : "Failed to verify invitation. Please try again.")
            } finally {
                setLoading(false)
            }
        }

        if (token && email) {
            verifyInvitation()
        } else {
            setError("Invalid invitation link. Missing token or email.")
            setLoading(false)
        }
    }, [token, email])

    const handleAcceptInvitation = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!isExistingUser) {
            if (!name.trim()) {
                setError("Name is required")
                return
            }
            if (password.length < 8) {
                setError("Password must be at least 8 characters long")
                return
            }
            if (password !== confirmPassword) {
                setError("Passwords do not match")
                return
            }
        }

        setAccepting(true)
        setError("")

        try {
            await acceptInvitationApi({
                token: token!,
                email: email!,
                name: isExistingUser ? undefined : name,
                password: password,
            })

            // Redirect to dashboard or login
            if (isExistingUser) {
                // If existing user, they should be logged in now
                router.push("/dashboard")
            } else {
                // If new user, redirect to login
                router.push("/login?message=Account created successfully. Please log in.")
            }
        } catch (err) {
            console.error("Failed to accept invitation:", err)
            setError(err instanceof Error ? err.message : "Failed to accept invitation. Please try again.")
        } finally {
            setAccepting(false)
        }
    }

    const getRoleBadge = (role: string) => {
        if (role === "ADMIN") {
            return (
                <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                </Badge>
            )
        }
        return (
            <Badge variant="outline" className="border-muted-foreground/30 bg-muted/50 text-muted-foreground">
                Member
            </Badge>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Verifying invitation...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (error && !invitation) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-destructive/50">
                    <CardHeader>
                        <div className="flex items-center justify-center mb-4">
                            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                                <XCircle className="h-8 w-8 text-destructive" />
                            </div>
                        </div>
                        <CardTitle className="text-center text-2xl">Invalid Invitation</CardTitle>
                        <CardDescription className="text-center">{error}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                                <p className="mb-2">This invitation may be:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Expired (invitations are valid for 7 days)</li>
                                    <li>Already accepted</li>
                                    <li>Cancelled by the workspace admin</li>
                                    <li>Invalid or corrupted link</li>
                                </ul>
                            </div>
                            <Button onClick={() => router.push("/login")} className="w-full">
                                Go to Login
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-center text-2xl">You&apos;re Invited!</CardTitle>
                    <CardDescription className="text-center">
                        Accept your invitation to join the workspace
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {invitation && (
                        <div className="space-y-6">
                            {/* Invitation Details */}
                            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-muted-foreground">Workspace</p>
                                        <p className="font-semibold">{invitation.workspace?.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                                        <Mail className="h-5 w-5 text-accent" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-muted-foreground">Email</p>
                                        <p className="font-semibold">{invitation.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                        <Shield className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-muted-foreground">Role</p>
                                        <div className="mt-1">{getRoleBadge(invitation.role)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleAcceptInvitation} className="space-y-4">
                                {isExistingUser ? (
                                    <>
                                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                                            <div className="flex gap-3">
                                                <AlertCircle className="h-5 w-5 text-blue-500 flex-0 mt-0.5" />
                                                <div className="text-sm">
                                                    <p className="font-medium text-blue-600 dark:text-blue-400 mb-1">
                                                        Existing Account Detected
                                                    </p>
                                                    <p className="text-blue-600/80 dark:text-blue-400/80">
                                                        An account with this email already exists. Please enter your password to accept the
                                                        invitation.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="password">Password</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="Enter your password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                disabled={accepting}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Full Name</Label>
                                            <Input
                                                id="name"
                                                type="text"
                                                placeholder="Enter your full name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                required
                                                disabled={accepting}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="password">Password</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="Create a password (min. 8 characters)"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                minLength={8}
                                                disabled={accepting}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                                            <Input
                                                id="confirmPassword"
                                                type="password"
                                                placeholder="Confirm your password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                required
                                                disabled={accepting}
                                            />
                                        </div>
                                    </>
                                )}

                                {error && (
                                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                                        <p className="text-sm text-destructive">{error}</p>
                                    </div>
                                )}

                                <Button type="submit" className="w-full" size="lg" disabled={accepting}>
                                    {accepting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Accepting...
                                        </>
                                    ) : (
                                        <>
                                            Accept Invitation
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </form>

                            <div className="text-center">
                                <p className="text-sm text-muted-foreground">
                                    Already have an account?{" "}
                                    <Button variant="link" className="p-0 h-auto" onClick={() => router.push("/login")}>
                                        Sign in
                                    </Button>
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function AcceptInvitationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Loading...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        }>
            <AcceptInvitationContent />
        </Suspense>
    )
}