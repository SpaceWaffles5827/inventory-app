import { Mail, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Compact email / phone links for table cells and list cards. Links stop propagation so rows stay clickable. */
export function ContactLinks({
  email,
  phone,
  className,
  emptyLabel = "No contact details",
}: {
  email?: string | null
  phone?: string | null
  className?: string
  emptyLabel?: string
}) {
  if (!email && !phone) {
    return <span className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</span>
  }
  return (
    <div className={cn("min-w-0 space-y-0.5 text-sm", className)}>
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Mail className="size-3.5 shrink-0" />
          <span className="truncate">{email}</span>
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Phone className="size-3.5 shrink-0" />
          <span className="truncate tabular-nums">{phone}</span>
        </a>
      )}
    </div>
  )
}

/** Active / Inactive pill for suppliers and customers */
export function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <Badge variant={active ? "success" : "muted"} className={cn("gap-1.5", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {active ? "Active" : "Inactive"}
    </Badge>
  )
}
