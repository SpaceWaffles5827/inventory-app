import { Crown, Shield, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"
import { normalizeRole, ROLE_META } from "./roles"

const ROLE_ICON = { OWNER: Crown, ADMIN: Shield, MEMBER: User } as const

export function RoleBadge({ role, className }: { role: string | null | undefined; className?: string }) {
  const r = normalizeRole(role)
  const Icon = ROLE_ICON[r]
  return (
    <Badge
      variant={r === "OWNER" ? "outline" : r === "ADMIN" ? "secondary" : "muted"}
      className={cn(r === "OWNER" && "border-transparent bg-primary/10 text-primary", className)}
    >
      <Icon aria-hidden />
      {ROLE_META[r].label}
    </Badge>
  )
}

export function MemberAvatar({
  name,
  email,
  className,
  fallbackClassName,
}: {
  name?: string | null
  email?: string | null
  className?: string
  fallbackClassName?: string
}) {
  const initials = getInitials(name || email?.split("@")[0] || null)
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarFallback className={cn("bg-primary/10 text-xs font-semibold text-primary", fallbackClassName)}>{initials}</AvatarFallback>
    </Avatar>
  )
}
