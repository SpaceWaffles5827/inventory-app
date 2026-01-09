"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  UserPlus,
  Trash2,
  Crown,
  ShieldIcon,
  User,
  Mail,
  Search,
  MoreVertical,
  UserCog,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  Copy,
  Check,
  Info,
  Shield,
  Users,
  Loader2,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getMembersApi,
  updateMemberRoleApi,
  removeMemberApi,
  inviteMemberApi,
  getInvitationsApi,
  cancelInvitationApi,
  resendInvitationApi,
  type WorkspaceMember,
  type Invitation,
} from "@/lib/api/workspaceMembers.api"

export default function MembersPage() {
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [searchQuery, setSearchQuery] = useState("")
  const [sending, setSending] = useState(false)
  const [roleFilter, setRoleFilter] = useState("all")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showRoleInfo, setShowRoleInfo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([])

  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem("currentWorkspaceId") : null

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    const loadData = async (id: string) => {
      try {
        const [membersRes, invitesRes] = await Promise.all([
          getMembersApi(id),
          getInvitationsApi(id)
        ])

        if (membersRes.data?.members) {
          setMembers(membersRes.data.members)
        }

        if (invitesRes.data?.invitations) {
          setPendingInvites(invitesRes.data.invitations)
        }
      } catch (error) {
        console.error("Failed to load data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData(workspaceId)
  }, [workspaceId])

  const loadInvitations = async (workspaceId: string) => {
    try {
      const response = await getInvitationsApi(workspaceId)
      if (response.data?.invitations) {
        setPendingInvites(response.data.invitations)
      }
    } catch (error) {
      console.error("Failed to load invitations:", error)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !workspaceId) return

    setSending(true)
    try {
      await inviteMemberApi(inviteEmail, inviteRole, workspaceId)
      await loadInvitations(workspaceId)
      setShowInviteDialog(false)
      setInviteEmail("")
      setInviteRole("member")
    } catch (error) {
      console.error("Failed to invite member:", error)
      alert(error instanceof Error ? error.message : "Failed to send invitation")
    } finally {
      setSending(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!workspaceId) return
    if (!confirm("Are you sure you want to remove this member?")) return

    try {
      await removeMemberApi(memberId, workspaceId)
      setMembers(members.filter((m) => m.id !== memberId))
    } catch (error) {
      console.error("Failed to remove member:", error)
      alert(error instanceof Error ? error.message : "Failed to remove member")
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!workspaceId) return
    if (!confirm("Are you sure you want to cancel this invitation?")) return

    try {
      await cancelInvitationApi(inviteId, workspaceId)
      setPendingInvites(pendingInvites.filter((i) => i.id !== inviteId))
    } catch (error) {
      console.error("Failed to cancel invitation:", error)
      alert(error instanceof Error ? error.message : "Failed to cancel invitation")
    }
  }

  const handleResendInvite = async (inviteId: string) => {
    if (!workspaceId) return

    try {
      await resendInvitationApi(inviteId, workspaceId)
      alert("Invitation resent successfully")
    } catch (error) {
      console.error("Failed to resend invitation:", error)
      alert(error instanceof Error ? error.message : "Failed to resend invitation")
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!workspaceId) return

    try {
      const response = await updateMemberRoleApi(memberId, newRole, workspaceId)
      const updatedMember = response.data?.member
      if (updatedMember) {
        setMembers(members.map((m) => (m.id === memberId ? updatedMember : m)))
      }
    } catch (error) {
      console.error("Failed to update role:", error)
      alert(error instanceof Error ? error.message : "Failed to update member role")
    }
  }

  const handleCopyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return "just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
    return date.toLocaleDateString()
  }

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || member.role.toLowerCase() === roleFilter.toLowerCase()
    return matchesSearch && matchesRole
  })

  const stats = [
    {
      title: "Total Members",
      value: members.length,
      icon: User,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Active Members",
      value: members.length,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Pending Invites",
      value: pendingInvites.length,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Admins",
      value: members.filter((m) => m.role === "ADMIN" || m.role === "OWNER").length,
      icon: ShieldIcon,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ]

  const getRoleBadge = (role: string) => {
    if (role === "OWNER") {
      return (
        <Badge variant="outline" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          <Crown className="h-3 w-3 mr-1" />
          Owner
        </Badge>
      )
    }
    if (role === "ADMIN") {
      return (
        <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
          <ShieldIcon className="h-3 w-3 mr-1" />
          Admin
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-muted-foreground/30 bg-muted/50 text-muted-foreground">
        <User className="h-3 w-3 mr-1" />
        Member
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading team members...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Team Members
              </h1>
              <Dialog open={showRoleInfo} onOpenChange={setShowRoleInfo}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      Understanding Roles & Permissions
                    </DialogTitle>
                    <DialogDescription>
                      Learn about the different roles and what permissions each role has in your workspace.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                    {/* Owner Role */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <Crown className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <span className="font-semibold text-lg text-yellow-600 dark:text-yellow-400">Owner</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Full control over the workspace including deletion, billing, and all settings. Only one owner
                        per workspace.
                      </p>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>Manage billing & subscription</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>Delete workspace</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>All admin permissions</span>
                        </div>
                      </div>
                    </div>

                    {/* Admin Role */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-semibold text-lg text-primary">Admin</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Manage team members, inventory, and workspace settings. Cannot delete workspace or manage
                        billing.
                      </p>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>Invite & remove members</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>Manage all inventory</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>Configure workspace settings</span>
                        </div>
                      </div>
                    </div>

                    {/* Member Role */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <span className="font-semibold text-lg text-muted-foreground">Member</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        View and edit inventory items, manage stock levels. Cannot access team or workspace settings.
                      </p>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>View all inventory</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>Add & edit items</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-0" />
                          <span>Adjust stock levels</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-muted-foreground mt-2">Manage workspace members and invitations</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="gap-2 bg-transparent">
              <Download className="h-5 w-5" />
              Export
            </Button>
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 text-white">
                  <UserPlus className="h-5 w-5" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join this workspace. They&apos;ll receive an email with instructions.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInviteMember} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="inviteEmail">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="inviteEmail"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="pl-9"
                        required
                        disabled={sending}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inviteRole">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole} disabled={sending}>
                      <SelectTrigger id="inviteRole">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Member</span>
                            <span className="text-xs text-muted-foreground">Can view and edit inventory</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Admin</span>
                            <span className="text-xs text-muted-foreground">Full access except workspace deletion</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowInviteDialog(false)}
                      disabled={sending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={sending}>
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Invitation"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="border-border/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`h-12 w-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="members" className="gap-2">
              <User className="h-4 w-4" />
              Active Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending Invites ({pendingInvites.length})
            </TabsTrigger>
          </TabsList>

          {/* Active Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Active Members</CardTitle>
                    <CardDescription>
                      {filteredMembers.length} of {members.length} members
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full sm:w-40">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-lg border border-border/50 hover:bg-muted/30 hover:border-border transition-all gap-4"
                    >
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <Avatar className="h-14 w-14 ring-2 ring-border">
                          <AvatarImage src="/placeholder.svg" />
                          <AvatarFallback className="bg-linear-to-br from-primary/20 to-accent/20 text-foreground text-base font-semibold">
                            {member.user.name
                              ? member.user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                              : member.user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-base truncate">
                              {member.user.name || member.user.email}
                            </p>
                            {getRoleBadge(member.role)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 flex-0" />
                            <span className="truncate">{member.user.email}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted"
                              onClick={() => handleCopyEmail(member.user.email, member.id)}
                            >
                              {copiedId === member.id ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Active {getRelativeTime(member.lastActive)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {member.role !== "OWNER" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                                <MoreVertical className="h-4 w-4" />
                                Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleChangeRole(member.id, "ADMIN")}>
                                <UserCog className="h-4 w-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangeRole(member.id, "MEMBER")}>
                                <User className="h-4 w-4 mr-2" />
                                Make Member
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {member.role === "OWNER" && (
                          <Badge variant="secondary" className="pointer-events-none">
                            Cannot modify
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div className="text-center py-12">
                      <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No members found matching your filters</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Invites Tab */}
          <TabsContent value="invites" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <CardTitle>Pending Invitations</CardTitle>
                    <CardDescription>Invitations waiting to be accepted</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {pendingInvites.length > 0 ? (
                  <div className="space-y-3">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 gap-4"
                      >
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center flex-0">
                            <Mail className="h-6 w-6 text-yellow-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold truncate">{invite.email}</p>
                              {getRoleBadge(invite.role)}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5">
                              <p>Sent {getRelativeTime(invite.createdAt)}</p>
                              <p className="text-xs">Expires {new Date(invite.expiresAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleResendInvite(invite.id)}>
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground mb-2">No pending invitations</p>
                    <p className="text-sm text-muted-foreground">Invite team members to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}