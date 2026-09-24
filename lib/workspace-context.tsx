"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { getUserProfileApi } from "@/lib/api/auth.api"
import { createWorkspaceApi, getWorkspacesApi, type WorkspaceWithMembers } from "@/lib/api/workspace.api"
import { getErrorMessage } from "@/lib/api/client"

export const WORKSPACE_STORAGE_KEY = "currentWorkspaceId"

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER"

export interface SessionUser {
  id: string
  email: string
  name: string
}

interface WorkspaceContextValue {
  user: SessionUser | null
  workspaces: WorkspaceWithMembers[]
  workspace: WorkspaceWithMembers | null
  /** Empty string until loaded — pages should wait for `ready` before fetching */
  workspaceId: string
  role: WorkspaceRole | null
  isAdmin: boolean
  isOwner: boolean
  ready: boolean
  error: string | null
  switchWorkspace: (id: string) => void
  createWorkspace: (data: { name: string; description?: string }) => Promise<WorkspaceWithMembers | null>
  refresh: () => Promise<void>
  setUser: (user: SessionUser) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function readStoredWorkspaceId(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeWorkspaceId(id: string) {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
  } catch {
    // storage unavailable (private mode) — the in-memory state still works
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMembers[]>([])
  const [workspaceId, setWorkspaceId] = useState("")
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const profile = await getUserProfileApi()
      const profileUser = profile.data?.user
      if (!profileUser) throw Object.assign(new Error("Not signed in"), { status: 401 })
      setUser(profileUser)

      const res = await getWorkspacesApi()
      const list = res.data?.workspaces ?? []
      setWorkspaces(list)

      const stored = readStoredWorkspaceId()
      const chosen = list.find((w) => w.id === stored) ?? list[0]
      if (chosen) {
        setWorkspaceId(chosen.id)
        storeWorkspaceId(chosen.id)
      } else {
        // e.g. the last workspace was deleted — the layout then shows the "create a workspace" screen
        setWorkspaceId("")
      }
      setError(null)
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.replace(`/login?next=${next}`)
        return
      }
      setError(getErrorMessage(err, "Couldn't load your workspace"))
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const switchWorkspace = useCallback(
    (id: string) => {
      if (id === workspaceId) return
      storeWorkspaceId(id)
      setWorkspaceId(id)
    },
    [workspaceId]
  )

  const createWorkspace = useCallback(async (data: { name: string; description?: string }) => {
    const res = await createWorkspaceApi(data)
    const created = res.data?.workspace as WorkspaceWithMembers | undefined
    if (!created) return null
    // re-fetch so the new workspace carries role/_count like the others
    const list = (await getWorkspacesApi()).data?.workspaces ?? [created]
    setWorkspaces(list)
    storeWorkspaceId(created.id)
    setWorkspaceId(created.id)
    return list.find((w) => w.id === created.id) ?? created
  }, [])

  const value = useMemo<WorkspaceContextValue>(() => {
    const workspace = workspaces.find((w) => w.id === workspaceId) ?? null
    const role = (workspace?.members?.[0]?.role as WorkspaceRole | undefined) ?? null
    return {
      user,
      workspaces,
      workspace,
      workspaceId,
      role,
      isAdmin: role === "OWNER" || role === "ADMIN",
      isOwner: role === "OWNER",
      ready,
      error,
      switchWorkspace,
      createWorkspace,
      refresh: load,
      setUser,
    }
  }, [user, workspaces, workspaceId, ready, error, switchWorkspace, createWorkspace, load])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider> (app/dashboard/layout.tsx)")
  return ctx
}
