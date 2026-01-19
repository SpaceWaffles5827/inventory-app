"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Package,
  LayoutDashboard,
  Settings,
  LogOut,
  Truck,
  FolderOpen,
  MapPin,
  Building2,
  ShoppingCart,
  UserCog,
  ChevronDown,
  Plus,
  Check,
  CreditCard,
  ScanLine,
} from "lucide-react"
import { useState, useEffect } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkspaceApi, getWorkspacesApi } from "@/lib/api/workspace.api"
import { logoutUserApi } from "@/lib/api/auth.api"
import { Textarea } from "@/components/ui/textarea"
import { getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { ScanModal } from "@/components/scanModal"

interface Workspace {
  id: string
  name: string
  description: string | null
  members?: Array<{
    role: string
  }>
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [currentWorkspace, setCurrentWorkspace] = useState("Main Warehouse")
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState("")
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [allItems, setAllItems] = useState<ItemWithRelations[]>([])

  const navItems = [
    { name: "Inventory", href: "/dashboard", icon: LayoutDashboard },
    { name: "Categories", href: "/dashboard/categories", icon: FolderOpen },
    { name: "Locations", href: "/dashboard/locations", icon: MapPin },
    { name: "Suppliers", href: "/dashboard/suppliers", icon: Truck },
    { name: "Customers", href: "/dashboard/customers", icon: ShoppingCart },
    { name: "Members", href: "/dashboard/members", icon: UserCog },
    { name: "Subscription", href: "/dashboard/subscription", icon: CreditCard },
  ]

  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const response = await getWorkspacesApi()
        if (response.data?.workspaces) {
          setWorkspaces(response.data.workspaces)
          const savedWorkspaceId = localStorage.getItem("currentWorkspaceId")
          if (savedWorkspaceId) {
            const savedWorkspace = response.data.workspaces.find((w) => w.id === savedWorkspaceId)
            if (savedWorkspace) {
              setCurrentWorkspace(savedWorkspace.name)
              setCurrentWorkspaceId(savedWorkspace.id)
            } else if (response.data.workspaces.length > 0) {
              setCurrentWorkspace(response.data.workspaces[0].name)
              setCurrentWorkspaceId(response.data.workspaces[0].id)
              localStorage.setItem("currentWorkspaceId", response.data.workspaces[0].id)
            }
          } else if (response.data.workspaces.length > 0) {
            setCurrentWorkspace(response.data.workspaces[0].name)
            setCurrentWorkspaceId(response.data.workspaces[0].id)
            localStorage.setItem("currentWorkspaceId", response.data.workspaces[0].id)
          }
        }
      } catch (err) {
        console.error("Failed to load workspaces:", err)
      } finally {
        setLoading(false)
      }
    }
    loadWorkspaces()
  }, [])

  // Load items when workspace changes
  useEffect(() => {
    async function loadItems() {
      if (currentWorkspaceId) {
        try {
          const response = await getItemsApi(currentWorkspaceId)
          if (response.data?.items) {
            setAllItems(response.data.items)
          }
        } catch (err) {
          console.error("Failed to load items:", err)
        }
      }
    }
    loadItems()
  }, [currentWorkspaceId])

  const handleWorkspaceSwitch = (workspace: Workspace) => {
    setCurrentWorkspace(workspace.name)
    setCurrentWorkspaceId(workspace.id)
    localStorage.setItem("currentWorkspaceId", workspace.id)
    window.location.reload()
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return
    setCreating(true)
    setError("")
    try {
      const response = await createWorkspaceApi({
        name: newWorkspaceName.trim(),
        description: newWorkspaceDescription.trim() || undefined,
      })
      if (response.data?.workspace) {
        setWorkspaces([...workspaces, response.data.workspace])
        setCurrentWorkspace(response.data.workspace.name)
        setCurrentWorkspaceId(response.data.workspace.id)
        localStorage.setItem("currentWorkspaceId", response.data.workspace.id)
        setNewWorkspaceName("")
        setNewWorkspaceDescription("")
        setShowCreateDialog(false)
        window.location.reload()
      }
    } catch (err) {
      console.error("Create workspace error:", err)
      setError(err instanceof Error ? err.message : "Failed to create workspace")
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutUserApi()
      localStorage.removeItem("currentWorkspaceId")
      router.push("/login")
    } catch (err) {
      console.error("Logout error:", err)
      localStorage.removeItem("currentWorkspaceId")
      router.push("/login")
    }
  }

  const getUserRole = (workspace: Workspace) => {
    if (workspace.members && workspace.members.length > 0) {
      return workspace.members[0].role
    }
    return "Member"
  }

  useEffect(() => {
    if (currentWorkspaceId) {
      localStorage.setItem("currentWorkspaceId", currentWorkspaceId)
    }
  }, [currentWorkspaceId])

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/40">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive =
              item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${isActive ? "text-accent" : "text-muted-foreground active:text-foreground"
                  }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "fill-accent/20" : ""}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowScanModal(true)}
        className="lg:hidden fixed bottom-20 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-accent to-primary shadow-lg flex items-center justify-center transition-all hover:scale-110"
      >
        <ScanLine className="h-6 w-6 text-accent-foreground" />
      </button>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 border-r border-border/40 bg-card/80 backdrop-blur-xl flex-col">
        <div className="p-6 border-b border-border/40">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Package className="h-6 w-6 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold">StockFlow</span>
          </Link>
        </div>

        <div className="p-4 border-b border-border/40">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between gap-2" disabled={loading}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate text-sm">{loading ? "Loading..." : currentWorkspace}</span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>Your Workspaces</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceSwitch(workspace)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{workspace.name}</span>
                    <span className="text-xs text-muted-foreground">{getUserRole(workspace)}</span>
                  </div>
                  {currentWorkspace === workspace.name && <Check className="h-4 w-4 text-accent" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowCreateDialog(true)} className="cursor-pointer">
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-3 ${isActive ? "bg-accent/10 text-accent" : ""}`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className="px-4 pb-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 border-primary/50 text-primary"
            onClick={() => setShowScanModal(true)}
          >
            <ScanLine className="h-5 w-5" />
            Scan Item
          </Button>
        </div>

        <div className="p-4 border-t border-border/40 space-y-2">
          <Link href="/dashboard/settings">
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Settings className="h-5 w-5" />
              Settings
            </Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start gap-3 text-destructive" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Workspace Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                placeholder="e.g., East Coast Warehouse"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-description">Description (Optional)</Label>
              <Textarea
                id="workspace-description"
                placeholder="Brief description..."
                value={newWorkspaceDescription}
                onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                disabled={creating}
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} disabled={creating || !newWorkspaceName.trim()}>
              {creating ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scan Modal Component */}
      <ScanModal open={showScanModal} onOpenChange={setShowScanModal} allItems={allItems} currentWorkspaceId={currentWorkspaceId} />
    </>
  )
}