"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteWorkspaceApi } from "@/lib/api/workspace.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatNumber } from "@/lib/format"
import { SettingsSection } from "./settings-section"

function DeleteWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const { workspace, workspaces, refresh } = useWorkspace()
  const [typed, setTyped] = useState("")
  const [deleting, setDeleting] = useState(false)

  const name = workspace?.name ?? ""
  const matches = typed.trim() === name.trim() && name.trim() !== ""
  const itemCount = workspace?._count?.items ?? 0
  const memberCount = workspace?._count?.members ?? 0

  const handleOpenChange = (next: boolean) => {
    if (deleting) return
    if (!next) setTyped("")
    onOpenChange(next)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!workspace || !matches) return
    setDeleting(true)
    try {
      await deleteWorkspaceApi(workspace.id)
      toast.success(`Deleted ${name}`)
      const hasOthers = workspaces.some((w) => w.id !== workspace.id)
      if (hasOthers) {
        // refresh() drops the deleted workspace and falls back to another one
        await refresh()
        router.push("/dashboard")
      } else {
        // Nothing left to switch to — a full reload lands on the "create a workspace" screen
        window.location.replace("/dashboard")
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete the workspace"))
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Delete this workspace?</DialogTitle>
            <DialogDescription>
              This permanently deletes <strong className="text-foreground">{name}</strong> for everyone. It can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <li className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>
                {formatNumber(itemCount)} {itemCount === 1 ? "item" : "items"} with their lots, locations and stock
                history
              </span>
            </li>
            <li className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>
                Access for {formatNumber(memberCount)} {memberCount === 1 ? "member" : "members"} and all pending
                invitations
              </span>
            </li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="confirm-workspace-name" className="block font-normal leading-normal">
              Type <span className="font-semibold break-all">{name}</span> to confirm
            </Label>
            <Input
              id="confirm-workspace-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={deleting}
              className="h-10"
              data-testid="delete-workspace-confirm-input"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || deleting} data-testid="delete-workspace-submit">
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DangerZone() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <SettingsSection
        id="danger"
        title="Danger zone"
        description="Deleting the workspace removes all of its inventory, locations, stock history and members. This can't be undone."
        icon={TriangleAlert}
        tone="danger"
        footerHint="Only owners can delete a workspace."
        footer={
          <Button variant="destructive" onClick={() => setOpen(true)} data-testid="delete-workspace">
            <Trash2 /> Delete workspace
          </Button>
        }
      />
      <DeleteWorkspaceDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
