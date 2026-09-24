"use client"

import { useState } from "react"
import { Building2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWorkspace } from "@/lib/workspace-context"
import { getErrorMessage } from "@/lib/api/client"

/** Shown when a signed-in user has no workspaces yet (e.g. their last one was deleted). */
export function NoWorkspace() {
  const { createWorkspace } = useWorkspace()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await createWorkspace({ name: name.trim() })
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create workspace"))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary/10">
        <Building2 className="size-6 text-primary" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your first workspace</h1>
      <p className="mt-2 text-muted-foreground">
        A workspace holds your inventory, locations and team. You can create more later — one per warehouse or business.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-3">
        <Label htmlFor="first-workspace">Workspace name</Label>
        <Input
          id="first-workspace"
          placeholder="e.g. Main Warehouse"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !name.trim()} className="mt-2">
          {busy && <Loader2 className="animate-spin" />}
          Create workspace
        </Button>
      </form>
    </div>
  )
}
