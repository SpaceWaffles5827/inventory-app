"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkspace } from "@/lib/workspace-context"
import { getErrorMessage } from "@/lib/api/client"
import { getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" }

function WorkspaceMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground",
        className
      )}
    >
      {getInitials(name, "W")}
    </span>
  )
}

export function WorkspaceSwitcher({ className, onSwitched }: { className?: string; onSwitched?: () => void }) {
  const { workspaces, workspace, role, ready, switchWorkspace, createWorkspace } = useWorkspace()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)

  if (!ready) {
    return <Skeleton className={cn("h-12 w-full rounded-lg", className)} />
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const created = await createWorkspace({ name: name.trim(), description: description.trim() || undefined })
      toast.success(`Workspace “${created?.name ?? name.trim()}” created`)
      setName("")
      setDescription("")
      setCreateOpen(false)
      onSwitched?.()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create workspace"))
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              className
            )}
            data-testid="workspace-switcher"
          >
            <WorkspaceMark name={workspace?.name ?? "Workspace"} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{workspace?.name ?? "No workspace"}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {role ? ROLE_LABEL[role] : "Create one to get started"}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => {
                switchWorkspace(w.id)
                onSwitched?.()
              }}
              className="gap-2.5"
            >
              <WorkspaceMark name={w.name} className="size-6 text-[10px]" />
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspace?.id && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-md border border-dashed">
              <Plus className="size-3.5" />
            </span>
            New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Create a workspace</DialogTitle>
              <DialogDescription>
                Workspaces keep inventory, locations and team members separate — e.g. one per warehouse or business.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                placeholder="e.g. East Coast Warehouse"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
                autoFocus
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workspace-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="workspace-description"
                placeholder="What is this workspace for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={creating}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
