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
  Camera,
  RefreshCw,
  CheckCircle,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkspaceApi, getWorkspacesApi } from "@/lib/api/workspace.api"
import { logoutUserApi } from "@/lib/api/auth.api"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"

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
  const [cameraError, setCameraError] = useState("")
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<string[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [verificationCount, setVerificationCount] = useState(0)
  const [verificationCode, setVerificationCode] = useState<string | null>(null)

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
  const scannerElementId = "qr-reader"
  const initAttemptRef = useRef(0)

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
            const savedWorkspace = response.data.workspaces.find(w => w.id === savedWorkspaceId)
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

  useEffect(() => {
    if (showScanModal) {
      setVerificationCode(null)
      setVerificationCount(0)
      setScannedCode(null)
      setAwaitingConfirmation(false)
      setScanHistory([])
      setCameraError("")
      initAttemptRef.current = 0

      // Longer delay for iOS - needs more time for dialog to fully render
      setTimeout(() => {
        startScanner()
      }, 500)
    } else {
      stopScanner()
    }

    return () => stopScanner()
  }, [showScanModal])

  const startScanner = async () => {
    console.log("[SCANNER] Starting scanner (attempt", initAttemptRef.current + 1, ")...")
    initAttemptRef.current++

    try {
      // Check if element exists
      const element = document.getElementById(scannerElementId)
      if (!element) {
        console.error("[SCANNER] Scanner element not found, retrying...")
        if (initAttemptRef.current < 5) {
          setTimeout(startScanner, 300)
        } else {
          setCameraError("Failed to initialize scanner. Please try again.")
        }
        return
      }

      // Initialize Html5Qrcode
      html5QrcodeRef.current = new Html5Qrcode(scannerElementId)

      // iOS-optimized config
      const config = {
        fps: 10, // Lower FPS for iOS stability
        qrbox: function (viewfinderWidth: number, viewfinderHeight: number) {
          // Dynamic box size for different screen sizes
          const minEdgePercentage = 0.7
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
          const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage)
          return {
            width: qrboxSize,
            height: qrboxSize
          }
        },
        aspectRatio: 1.0,
        // Support all barcode formats
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.CODABAR,
        ],
      }

      console.log("[SCANNER] Getting cameras...")

      // Get cameras with better error handling
      let cameras
      try {
        cameras = await Html5Qrcode.getCameras()
      } catch (err: any) {
        console.error("[SCANNER] Camera access error:", err)
        setCameraError("Camera access denied. Please allow camera permissions in your browser settings.")
        return
      }

      console.log("[SCANNER] Available cameras:", cameras.length)

      if (cameras.length === 0) {
        setCameraError("No cameras found. Please check your device permissions.")
        return
      }

      // For iOS: Use facingMode constraint instead of specific camera ID
      // This works better on iPhones
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      let cameraConfig: any

      if (isMobile) {
        // Use facingMode for mobile (better iOS support)
        console.log("[SCANNER] Mobile device detected, using facingMode")
        cameraConfig = { facingMode: "environment" } // Rear camera
      } else {
        // Use camera ID for desktop
        let cameraId = cameras[0].id
        const rearCamera = cameras.find(camera =>
          camera.label.toLowerCase().includes('back') ||
          camera.label.toLowerCase().includes('rear') ||
          camera.label.toLowerCase().includes('environment')
        )

        if (rearCamera) {
          cameraId = rearCamera.id
          console.log("[SCANNER] Using rear camera:", rearCamera.label)
        } else {
          console.log("[SCANNER] Using camera:", cameras[0].label)
        }
        cameraConfig = cameraId
      }

      console.log("[SCANNER] Starting camera with config:", cameraConfig)

      // Start scanning
      await html5QrcodeRef.current.start(
        cameraConfig,
        config,
        (decodedText, decodedResult) => {
          console.log(`[SCANNER] 📷 Detected: ${decodedText}`)

          // Add to history
          setScanHistory(prev => [
            `${decodedText} (${new Date().toLocaleTimeString()})`,
            ...prev.slice(0, 4)
          ])

          // 3-READ VERIFICATION
          if (verificationCode === decodedText) {
            const newCount = verificationCount + 1
            setVerificationCount(newCount)
            console.log(`[SCANNER] ✓ Verification ${newCount}/3`)

            if (newCount >= 3) {
              console.log("[SCANNER] ✅ VERIFIED!")
              setScannedCode(decodedText)
              setAwaitingConfirmation(true)
              setVerificationCode(null)
              setVerificationCount(0)
              setIsScanning(false)

              // Stop scanning
              if (html5QrcodeRef.current) {
                html5QrcodeRef.current.pause(true)
              }
            }
          } else {
            console.log("[SCANNER] 🆕 New code, starting verification")
            setVerificationCode(decodedText)
            setVerificationCount(1)
          }
        },
        (errorMessage) => {
          // Silently ignore "not found" errors - they're normal
        }
      )

      setIsScanning(true)
      console.log("[SCANNER] ✅ Camera started successfully")

    } catch (err: any) {
      console.error("[SCANNER] Failed to start:", err)

      // Better error messages
      let errorMsg = "Failed to start camera. "
      if (err.message?.includes("Permission") || err.message?.includes("NotAllowed")) {
        errorMsg += "Please allow camera access in your browser settings."
      } else if (err.message?.includes("NotFound")) {
        errorMsg += "No camera found on this device."
      } else if (err.message?.includes("NotReadable")) {
        errorMsg += "Camera is being used by another app. Please close other apps and try again."
      } else {
        errorMsg += err.message || "Unknown error."
      }

      setCameraError(errorMsg)
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    console.log("[SCANNER] Stopping scanner...")

    if (html5QrcodeRef.current) {
      try {
        const state = html5QrcodeRef.current.getState()
        if (state === 2) { // 2 = SCANNING state
          await html5QrcodeRef.current.stop()
          console.log("[SCANNER] Camera stopped")
        }
        await html5QrcodeRef.current.clear()
      } catch (err) {
        console.error("[SCANNER] Error stopping:", err)
      }
      html5QrcodeRef.current = null
    }

    setIsScanning(false)
  }

  const handleConfirmScan = () => {
    console.log("[SCANNER] Confirmed:", scannedCode)
    setShowScanModal(false)
    // TODO: Search for item
    alert(`Searching for: ${scannedCode}`)
  }

  const handleRescan = async () => {
    setScannedCode(null)
    setAwaitingConfirmation(false)
    setVerificationCode(null)
    setVerificationCount(0)

    // Resume scanning
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.resume()
        setIsScanning(true)
      } catch (err) {
        console.error("[SCANNER] Error resuming:", err)
        // Restart scanner if resume fails
        await stopScanner()
        setTimeout(startScanner, 500)
      }
    }
  }

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
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-xl border-b border-border/40 z-50 flex items-center px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="text-lg font-bold">StockFlow</span>
        </Link>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" onClick={() => setShowScanModal(true)} className="text-primary">
            <ScanLine className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Mobile FAB */}
      <button onClick={() => setShowScanModal(true)} className="lg:hidden fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-accent to-primary shadow-lg flex items-center justify-center transition-all hover:scale-110">
        <ScanLine className="h-6 w-6 text-accent-foreground" />
      </button>

      {/* Desktop Sidebar - abbreviated for space */}
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
                <DropdownMenuItem key={workspace.id} onClick={() => handleWorkspaceSwitch(workspace)} className="flex items-center justify-between cursor-pointer">
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
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Button variant={isActive ? "secondary" : "ghost"} className={`w-full justify-start gap-3 ${isActive ? "bg-accent/10 text-accent" : ""}`}>
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className="px-4 pb-2">
          <Button variant="outline" className="w-full justify-start gap-3 border-primary/50 text-primary" onClick={() => setShowScanModal(true)}>
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
              <Input id="workspace-name" placeholder="e.g., East Coast Warehouse" value={newWorkspaceName} onChange={(e) => setNewWorkspaceName(e.target.value)} disabled={creating} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-description">Description (Optional)</Label>
              <Textarea id="workspace-description" placeholder="Brief description..." value={newWorkspaceDescription} onChange={(e) => setNewWorkspaceDescription(e.target.value)} disabled={creating} rows={3} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreateWorkspace} disabled={creating || !newWorkspaceName.trim()}>{creating ? "Creating..." : "Create Workspace"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scan Modal */}
      <Dialog open={showScanModal} onOpenChange={setShowScanModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Scan Barcode or QR Code</DialogTitle>
            <DialogDescription>
              {awaitingConfirmation ? "Confirm the scanned code" : isScanning ? "Scanning - hold code steady" : "Starting camera..."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!awaitingConfirmation && (
              <div>
                {cameraError ? (
                  <Alert variant="destructive" className="mb-4">
                    <Camera className="h-4 w-4" />
                    <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                  </Alert>
                ) : (
                  <div id={scannerElementId} className="rounded-lg overflow-hidden border-2 border-border min-h-[300px]" />
                )}
              </div>
            )}

            {scanHistory.length > 0 && !awaitingConfirmation && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-semibold mb-2 flex items-center gap-2">
                  Recent Scans:
                  {verificationCount > 0 && (
                    <span className="text-green-500 font-bold">Verifying {verificationCount}/3</span>
                  )}
                </p>
                <div className="space-y-1">
                  {scanHistory.map((scan, i) => (
                    <div key={i} className="text-xs font-mono text-muted-foreground">
                      {scan}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scannedCode && awaitingConfirmation && (
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-500 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-xs text-green-700 dark:text-green-400 font-semibold">Verified & Ready</p>
                  </div>
                  <p className="text-lg font-mono font-bold text-green-900 dark:text-green-300 break-all">{scannedCode}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2" onClick={handleRescan}>
                    <RefreshCw className="h-4 w-4" />
                    Rescan
                  </Button>
                  <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={handleConfirmScan}>
                    <CheckCircle className="h-4 w-4" />
                    Confirm
                  </Button>
                </div>
              </div>
            )}
          </div>
          {!awaitingConfirmation && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowScanModal(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}