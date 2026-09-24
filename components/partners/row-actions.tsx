"use client"

import Link from "next/link"
import { Fragment } from "react"
import { MoreHorizontal, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface RowAction {
  label: string
  icon?: LucideIcon
  /** Navigate instead of running a callback */
  href?: string
  onSelect?: () => void
  destructive?: boolean
  /** Draw a separator above this action */
  separated?: boolean
  hidden?: boolean
  "data-testid"?: string
}

/**
 * "…" menu for a table row / list card. Stops click propagation so clickable rows
 * don't also navigate (React events bubble through the menu portal).
 */
export function RowActions({
  actions,
  label = "Actions",
  className,
  "data-testid": testId,
}: {
  actions: RowAction[]
  label?: string
  className?: string
  "data-testid"?: string
}) {
  const visible = actions.filter((a) => !a.hidden)
  if (visible.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-10 shrink-0 text-muted-foreground hover:text-foreground md:size-9", className)}
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          data-testid={testId}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44" onClick={(e) => e.stopPropagation()}>
        {visible.map((action, i) => {
          const Icon = action.icon
          const content = (
            <>
              {Icon && <Icon />}
              {action.label}
            </>
          )
          return (
            <Fragment key={action.label}>
              {action.separated && i > 0 && <DropdownMenuSeparator />}
              {action.href ? (
                <DropdownMenuItem asChild data-testid={action["data-testid"]}>
                  <Link href={action.href}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant={action.destructive ? "destructive" : "default"}
                  onSelect={() => action.onSelect?.()}
                  data-testid={action["data-testid"]}
                >
                  {content}
                </DropdownMenuItem>
              )}
            </Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
