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
  ChevronLeft,
  List,
  AlertCircle,
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { getItemsApi, adjustStockApi, type ItemWithRelations } from "@/lib/api/items.api"

interface Workspace {
  id: string
  name: string
  description: string | null
  members?: Array<{
    role: string
  }>
}

type ScanStep = "select" | "scanItem" | "scanLocation" | "manualLocationSelect" | "adjustmentDetails" | "confirm"

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
  const [verificationCount, setVerificationCount] = useState(0)
  const [verificationCode, setVerificationCode] = useState<string | null>(null)

  // Workflow states
  const [scanMode, setScanMode] = useState<string | null>(null)
  const [scanStep, setScanStep] = useState<ScanStep>("select")
  const [scannedItem, setScannedItem] = useState<ItemWithRelations | null>(null)
  const [scannedLocation, setScannedLocation] = useState<any | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState<number>(1)
  const [adjustmentReason, setAdjustmentReason] = useState("")
  const [adjustmentNote, setAdjustmentNote] = useState("")
  const [allItems, setAllItems] = useState<ItemWithRelations[]>([])

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
  const scannerElementId = "qr-reader"
  const initAttemptRef = useRef(0)
  const verificationCodeRef = useRef<string | null>(null)
  const verificationCountRef = useRef(0)

  const navItems = [
    { name: "Inventory", href: "/dashboard", icon: LayoutDashboard },
    { name: "Categories", href: "/dashboard/categories", icon: FolderOpen },
    { name: "Locations", href: "/dashboard/locations", icon: MapPin },
    { name: "Suppliers", href: "/dashboard/suppliers", icon: Truck },
    { name: "Customers", href: "/dashboard/customers", icon: ShoppingCart },
    { name: "Members", href: "/dashboard/members", icon: UserCog },
    { name: "Subscription", href: "/dashboard/subscription", icon: CreditCard },
  ]

  const scanModes = [
    {
      id: "lookup",
      title: "Look Up Item",
      description: "View item details and locations",
      icon: Package,
    },
    {
      id: "adjust",
      title: "Adjust Quantity",
      description: "Add or remove stock at a location",
      icon: Plus,
    },
    {
      id: "inventory-adjustment",
      title: "Inventory Adjustment",
      description: "Audit and correct stock levels",
      icon: Check,
    },
    {
      id: "location",
      title: "View Location",
      description: "See all items at a location",
      icon: MapPin,
    },
    {
      id: "edit",
      title: "Edit Item",
      description: "Update item information",
      icon: Settings,
    },
    {
      id: "move",
      title: "Move Item",
      description: "Transfer between locations",
      icon: Truck,
    },
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

  useEffect(() => {
    if (showScanModal && (scanStep === "scanItem" || scanStep === "scanLocation")) {
      setVerificationCode(null)
      setVerificationCount(0)
      setScannedCode(null)
      setScanHistory([])
      setCameraError("")
      initAttemptRef.current = 0
      verificationCodeRef.current = null
      verificationCountRef.current = 0

      setTimeout(() => {
        startScanner()
      }, 500)
    } else {
      stopScanner()
    }

    return () => stopScanner()
  }, [showScanModal, scanStep])

  const startScanner = async () => {
    console.log("[SCANNER] Starting scanner (attempt", initAttemptRef.current + 1, ")...")
    initAttemptRef.current++

    try {
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

      html5QrcodeRef.current = new Html5Qrcode(scannerElementId)

      // Config that works reliably on all devices
      const config = {
        fps: 5, // Reduced for better accuracy
        qrbox: { width: 250, height: 250 }, // Fixed size box - works everywhere
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

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      let cameraConfig: any

      if (isMobile) {
        console.log("[SCANNER] Mobile device detected, using facingMode")
        cameraConfig = { facingMode: "environment" }
      } else {
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

      await html5QrcodeRef.current.start(
        cameraConfig,
        config,
        (decodedText, decodedResult) => {
          console.log(`[SCANNER] 📷 Detected: ${decodedText}`)

          // Add basic quality filtering - ignore very short or suspiciously long codes
          if (decodedText.length < 3) {
            console.log("[SCANNER] ⚠️ Rejected: Too short (< 3 chars)")
            return
          }
          if (decodedText.length > 100) {
            console.log("[SCANNER] ⚠️ Rejected: Too long (> 100 chars)")
            return
          }

          setScanHistory(prev => [
            `${decodedText} (${new Date().toLocaleTimeString()})`,
            ...prev.slice(0, 4)
          ])

          // Use refs for verification to avoid stale closure issues
          // Require 5 consecutive reads of the same code (increased from 3 for accuracy)
          if (verificationCodeRef.current === decodedText) {
            verificationCountRef.current++
            const newCount = verificationCountRef.current
            setVerificationCount(newCount)
            console.log(`[SCANNER] ✓ Verification ${newCount}/5`)

            if (newCount >= 5) {
              console.log("[SCANNER] ✅ VERIFIED!")

              // Immediately process the scan without confirmation screen
              verificationCodeRef.current = null
              verificationCountRef.current = 0
              setVerificationCode(null)
              setVerificationCount(0)
              setIsScanning(false)

              if (html5QrcodeRef.current) {
                html5QrcodeRef.current.pause(true)
              }

              // Process the scan immediately
              handleVerifiedScan(decodedText)
            }
          } else {
            console.log("[SCANNER] 🆕 New code, starting verification")
            verificationCodeRef.current = decodedText
            verificationCountRef.current = 1
            setVerificationCode(decodedText)
            setVerificationCount(1)
          }
        },
        (errorMessage) => {
          // Silently ignore "not found" errors
        }
      )

      setIsScanning(true)
      console.log("[SCANNER] ✅ Camera started successfully")

    } catch (err: any) {
      console.error("[SCANNER] Failed to start:", err)

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
        if (state === 2) {
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

  const findItemByBarcode = (scannedCode: string, items: ItemWithRelations[]): ItemWithRelations | null => {
    const scanned = scannedCode.trim()

    console.log("[SCANNER] Searching for barcode:", scanned)
    console.log("[SCANNER] Available items:", items.length)
    console.log("[SCANNER] Database barcodes:", items.map(i => ({ name: i.name, barcode: i.barcode })))

    // Strategy 1: Exact match (case-insensitive)
    let item = items.find(i =>
      i.barcode?.trim().toLowerCase() === scanned.toLowerCase()
    )
    if (item) {
      console.log("[SCANNER] ✅ Found via exact match")
      return item
    }

    // Strategy 2: Match with leading zeros removed from scanned code
    const scannedWithoutLeadingZeros = scanned.replace(/^0+/, '')
    if (scannedWithoutLeadingZeros !== scanned) {
      item = items.find(i =>
        i.barcode?.trim().toLowerCase() === scannedWithoutLeadingZeros.toLowerCase()
      )
      if (item) {
        console.log("[SCANNER] ✅ Found via removing leading zeros from scan:", scanned, "->", scannedWithoutLeadingZeros)
        return item
      }
    }

    // Strategy 3: Match with leading zeros removed from database barcode
    item = items.find(i => {
      if (!i.barcode) return false
      const dbWithoutLeadingZeros = i.barcode.trim().replace(/^0+/, '')
      return dbWithoutLeadingZeros.toLowerCase() === scanned.toLowerCase()
    })
    if (item) {
      console.log("[SCANNER] ✅ Found via removing leading zeros from database")
      return item
    }

    // Strategy 4: Match both without leading zeros
    item = items.find(i => {
      if (!i.barcode) return false
      const dbWithoutLeadingZeros = i.barcode.trim().replace(/^0+/, '')
      return dbWithoutLeadingZeros.toLowerCase() === scannedWithoutLeadingZeros.toLowerCase()
    })
    if (item) {
      console.log("[SCANNER] ✅ Found via removing leading zeros from both")
      return item
    }

    // Strategy 5: For UPC-A (12 digits) / EAN-13 (13 digits) conversion
    if (scanned.length === 13 && scanned.startsWith('0')) {
      const upcA = scanned.substring(1) // Convert EAN-13 to UPC-A
      item = items.find(i =>
        i.barcode?.trim().toLowerCase() === upcA.toLowerCase()
      )
      if (item) {
        console.log("[SCANNER] ✅ Found via EAN-13 to UPC-A conversion:", scanned, "->", upcA)
        return item
      }
    }

    // Strategy 6: Try adding leading zero (UPC-A to EAN-13)
    if (scanned.length === 12) {
      const ean13 = '0' + scanned
      item = items.find(i =>
        i.barcode?.trim().toLowerCase() === ean13.toLowerCase()
      )
      if (item) {
        console.log("[SCANNER] ✅ Found via UPC-A to EAN-13 conversion:", scanned, "->", ean13)
        return item
      }
    }

    console.log("[SCANNER] ❌ No match found with any strategy")
    return null
  }

  const handleVerifiedScan = (scannedCode: string) => {
    console.log("[SCANNER] Processing verified scan:", scannedCode)

    if (!scannedCode) return

    if (scanStep === "scanItem") {
      const item = findItemByBarcode(scannedCode, allItems)

      if (!item) {
        console.log("[SCANNER] ❌ Item not found")
        setCameraError(`Item not found with barcode: ${scannedCode}`)
        return
      }

      console.log("[SCANNER] ✅ Item found:", item.name)
      setScannedItem(item)

      if (scanMode === "lookup") {
        console.log("[SCANNER] Navigating to item detail page")
        setShowScanModal(false)
        router.push(`/dashboard/items/${item.id}`)
        return
      } else if (scanMode === "edit") {
        console.log("[SCANNER] Navigating to edit item page")
        setShowScanModal(false)
        router.push(`/dashboard/items/${item.id}`)
        return
      } else if (scanMode === "adjust" || scanMode === "move" || scanMode === "inventory-adjustment") {
        console.log("[SCANNER] Moving to location scan step")
        setScanStep("scanLocation")
        return
      }
    } else if (scanStep === "scanLocation") {
      console.log("[SCANNER] Processing location scan:", scannedCode)
      // For now, we'll use the scanned code as location identifier
      setScannedLocation({ code: scannedCode, name: `Location ${scannedCode}` })

      if (scanMode === "location") {
        console.log("[SCANNER] Navigating to location view")
        setShowScanModal(false)
        router.push(`/dashboard/locations?code=${scannedCode}`)
        return
      } else if (scanMode === "adjust" || scanMode === "move" || scanMode === "inventory-adjustment") {
        console.log("[SCANNER] Moving to adjustment details")
        setScanStep("adjustmentDetails")
        return
      }
    }
  }

  const handleRescan = async () => {
    setScannedCode(null)
    setVerificationCode(null)
    setVerificationCount(0)
    verificationCodeRef.current = null
    verificationCountRef.current = 0
    setCameraError("")

    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.resume()
        setIsScanning(true)
      } catch (err) {
        console.error("[SCANNER] Error resuming:", err)
        await stopScanner()
        setTimeout(startScanner, 500)
      }
    }
  }

  const handleCloseModal = () => {
    setShowScanModal(false)
    setTimeout(() => {
      setScanMode(null)
      setScanStep("select")
      setScannedItem(null)
      setScannedLocation(null)
      setSelectedLocationId(null)
      setQuantity(1)
      setAdjustmentReason("")
      setAdjustmentNote("")
      setScannedCode(null)
      setCameraError("")
    }, 200)
  }

  const handleModeSelect = (modeId: string) => {
    setScanMode(modeId)
    if (modeId === "location") {
      setScanStep("scanLocation")
    } else {
      setScanStep("scanItem")
    }
  }

  const handleBack = () => {
    if (scanStep === "confirm") {
      if (scanMode === "adjust" || scanMode === "move" || scanMode === "inventory-adjustment") {
        setScanStep("adjustmentDetails")
      } else {
        setScanStep("scanItem")
      }
    } else if (scanStep === "adjustmentDetails") {
      setScanStep("scanLocation")
      setScannedLocation(null)
      setSelectedLocationId(null)
    } else if (scanStep === "scanLocation") {
      if (scanMode === "location") {
        setScanStep("select")
        setScanMode(null)
      } else {
        setScanStep("scanItem")
        setScannedItem(null)
      }
    } else if (scanStep === "scanItem") {
      setScanStep("select")
      setScanMode(null)
    } else if (scanStep === "manualLocationSelect") {
      setScanStep("scanLocation")
    }
  }

  const handleLocationSelect = (locationId: string) => {
    setSelectedLocationId(locationId)
  }

  const handleConfirmAction = async () => {
    if (!scannedItem) return

    try {
      if (scanMode === "adjust" || scanMode === "inventory-adjustment") {
        const locationId = selectedLocationId || scannedLocation?.id

        await adjustStockApi(scannedItem.id, {
          type: quantity >= 0 ? "INPUT" : "OUTPUT",
          quantity: Math.abs(quantity),
          reason: adjustmentReason,
          locationId: locationId,
        })

        console.log("Stock adjustment successful")
      }

      handleCloseModal()
      // Optionally refresh the page or show success message
      window.location.reload()
    } catch (err) {
      console.error("Action failed:", err)
      setError(err instanceof Error ? err.message : "Action failed")
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
      {/* Mobile Header - COMMENTED OUT FOR CUSTOM PAGE HEADERS */}
      {/* <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-xl border-b border-border/40 z-50 flex items-center px-4">
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
      </div> */}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/40">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${isActive
                  ? "text-accent"
                  : "text-muted-foreground active:text-foreground"
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
      <button onClick={() => setShowScanModal(true)} className="lg:hidden fixed bottom-20 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-accent to-primary shadow-lg flex items-center justify-center transition-all hover:scale-110">
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

      {/* Scan Modal with Workflow */}
      <Dialog open={showScanModal} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-2xl max-w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] p-0 gap-0 flex flex-col">
          {scanStep === "select" ? (
            <>
              <DialogHeader className="p-3 sm:p-4 border-b flex-shrink-0">
                <DialogTitle className="text-lg sm:text-base">Select Scan Action</DialogTitle>
                <DialogDescription className="text-xs sm:text-xs">Choose what you want to do</DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 sm:gap-2.5">
                  {scanModes.map((mode) => {
                    const Icon = mode.icon
                    return (
                      <button
                        key={mode.id}
                        onClick={() => handleModeSelect(mode.id)}
                        className="group relative flex items-center sm:flex-col sm:items-start gap-3 sm:gap-2 p-3 sm:p-3 rounded-lg border-2 border-border hover:border-primary/50 bg-card hover:bg-accent/5 transition-all hover:shadow-md active:scale-[0.98]"
                      >
                        <div className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors flex-shrink-0">
                          <Icon className="h-5 w-5 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div className="text-left flex-1 sm:flex-none sm:space-y-0.5">
                          <h3 className="font-semibold text-sm sm:text-sm">{mode.title}</h3>
                          <p className="text-xs sm:text-xs text-muted-foreground leading-tight">{mode.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2 p-3 sm:p-4 bg-muted/30 border-t flex-shrink-0">
                <Button variant="outline" onClick={handleCloseModal} className="flex-1 h-11 sm:h-9 bg-transparent">
                  Cancel
                </Button>
              </div>
            </>
          ) : scanStep === "scanItem" ? (
            <>
              <DialogHeader className="p-4 sm:p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-3 sm:gap-2">
                  <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 sm:h-7 sm:w-7 -ml-2">
                    <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                  <div>
                    <DialogTitle className="text-lg sm:text-base">
                      {scanModes.find((m) => m.id === scanMode)?.title}
                    </DialogTitle>
                    <DialogDescription className="text-sm sm:text-xs">Scan item barcode or QR code</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {cameraError ? (
                  <div className="p-4 space-y-3">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                    </Alert>
                    <Button
                      onClick={() => {
                        setCameraError("")
                        setScannedCode(null)
                        setVerificationCode(null)
                        setVerificationCount(0)
                        verificationCodeRef.current = null
                        verificationCountRef.current = 0
                        setTimeout(startScanner, 300)
                      }}
                      className="w-full"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div id={scannerElementId} className="rounded-lg overflow-hidden border-2 border-border min-h-[300px]" />
                  </div>
                )}

                {scanHistory.length > 0 && !cameraError && (
                  <div className="p-3 m-4 bg-muted/50 rounded-lg">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-2">
                      Recent Scans:
                      {verificationCount > 0 && (
                        <span className="text-green-500 font-bold">Verifying {verificationCount}/5</span>
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
              </div>

              {!cameraError && (
                <div className="flex gap-2 p-4 sm:p-4 bg-muted/30 border-t flex-shrink-0">
                  <Button variant="outline" onClick={handleBack} className="flex-1 h-12 sm:h-9 bg-transparent">
                    Back
                  </Button>
                </div>
              )}
            </>
          ) : scanStep === "scanLocation" ? (
            <>
              <DialogHeader className="p-4 sm:p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-3 sm:gap-2">
                  <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 sm:h-7 sm:w-7 -ml-2">
                    <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                  <div>
                    <DialogTitle className="text-lg sm:text-base">
                      {scanMode === "location" ? "View Location" : "Scan Location"}
                    </DialogTitle>
                    <DialogDescription className="text-sm sm:text-xs">
                      {scanMode === "location"
                        ? "Scan location barcode"
                        : `Scan location for ${scannedItem?.name || "item"}`}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {cameraError ? (
                  <div className="p-4 space-y-3">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                    </Alert>
                    <Button
                      onClick={() => {
                        setCameraError("")
                        setScannedCode(null)
                        setVerificationCode(null)
                        setVerificationCount(0)
                        verificationCodeRef.current = null
                        verificationCountRef.current = 0
                        setTimeout(startScanner, 300)
                      }}
                      className="w-full"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div id={scannerElementId} className="rounded-lg overflow-hidden border-2 border-border min-h-[300px]" />
                  </div>
                )}

                {scanHistory.length > 0 && !cameraError && (
                  <div className="p-3 m-4 bg-muted/50 rounded-lg">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-2">
                      Recent Scans:
                      {verificationCount > 0 && (
                        <span className="text-green-500 font-bold">Verifying {verificationCount}/5</span>
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
              </div>

              {!cameraError && (
                <div className="flex gap-2 p-4 sm:p-4 bg-muted/30 border-t flex-shrink-0">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleBack} className="flex-1 h-12 sm:h-9 bg-transparent">
                      Back
                    </Button>
                  </div>
                  {scannedItem && (
                    <Button
                      variant="outline"
                      onClick={() => setScanStep("manualLocationSelect")}
                      className="w-full h-10 sm:h-9 bg-transparent gap-2"
                    >
                      <List className="h-4 w-4" />
                      Select Location Manually
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : scanStep === "manualLocationSelect" && scannedItem ? (
            <>
              <DialogHeader className="p-4 sm:p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-3 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setScanStep("scanLocation")}
                    className="h-8 w-8 sm:h-7 sm:w-7 -ml-2"
                  >
                    <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                  <div>
                    <DialogTitle className="text-lg sm:text-base">Select Location</DialogTitle>
                    <DialogDescription className="text-sm sm:text-xs">
                      Choose from available locations for {scannedItem.name}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 sm:p-4 min-h-0">
                <div className="space-y-2">
                  {scannedItem.locations.map((location) => (
                    <button
                      key={location.locationId}
                      onClick={() => handleLocationSelect(location.locationId)}
                      className={`w-full p-3 sm:p-2.5 rounded-lg border-2 transition-all text-left ${selectedLocationId === location.locationId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-accent/5"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 sm:gap-2">
                          <MapPin className="h-5 w-5 sm:h-4 sm:w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-sm">{location.location.code || location.location.name}</p>
                            <p className="text-xs text-muted-foreground">{location.location.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">Stock: {location.quantity}</p>
                          </div>
                        </div>
                        {selectedLocationId === location.locationId && (
                          <Check className="h-5 w-5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 sm:gap-2 p-4 sm:p-4 bg-muted/30 border-t flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setScanStep("scanLocation")}
                  className="flex-1 h-12 sm:h-9 bg-transparent"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setScanStep("adjustmentDetails")}
                  disabled={!selectedLocationId}
                  className="flex-1 h-12 sm:h-9"
                >
                  Continue
                </Button>
              </div>
            </>
          ) : scanStep === "adjustmentDetails" && scannedItem && (scannedLocation || selectedLocationId) ? (
            <>
              <DialogHeader className="p-4 sm:p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-3 sm:gap-2">
                  <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 sm:h-7 sm:w-7 -ml-2">
                    <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                  <div>
                    <DialogTitle className="text-lg sm:text-base">Update Stock</DialogTitle>
                    <DialogDescription className="text-sm sm:text-xs">
                      Adjust inventory quantity for {scannedItem.name}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 sm:p-4 min-h-0">
                <div className="space-y-4 sm:space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                    <div className="w-12 h-12 sm:w-10 sm:h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 sm:h-5 sm:w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{scannedItem.name}</h3>
                      <p className="text-xs text-muted-foreground">{scannedItem.itemNumber}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </Label>
                    <div className="flex items-center space-x-2 sm:space-x-3 p-2.5 sm:p-3 rounded-lg border border-primary bg-primary/5">
                      <div className="flex-1 min-w-0">
                        {scannedLocation ? (
                          <>
                            <p className="font-mono font-semibold text-xs sm:text-sm">{scannedLocation.code}</p>
                            <p className="text-xs text-muted-foreground">{scannedLocation.name}</p>
                          </>
                        ) : (
                          <>
                            <p className="font-mono font-semibold text-xs sm:text-sm">
                              {scannedItem.locations.find((l) => l.locationId === selectedLocationId)?.location.code}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {scannedItem.locations.find((l) => l.locationId === selectedLocationId)?.location.name}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">
                          {scannedItem.locations.find((l) =>
                            scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId,
                          )?.quantity || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Adjustment</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(quantity - 1)}
                        className="h-14 w-14 sm:h-12 sm:w-12 shrink-0 text-xl bg-transparent"
                      >
                        −
                      </Button>

                      <Input
                        type="text"
                        value={quantity > 0 ? `+${quantity}` : quantity === 0 ? "0" : `${quantity}`}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9-+]/g, "")
                          const num = Number.parseInt(val) || 0
                          setQuantity(num)
                        }}
                        className="h-14 sm:h-12 text-center text-xl sm:text-lg font-bold"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(quantity + 1)}
                        className="h-14 w-14 sm:h-12 sm:w-12 shrink-0 text-xl bg-transparent"
                      >
                        +
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Current:{" "}
                      {scannedItem.locations.find((l) =>
                        scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId,
                      )?.quantity || 0}{" "}
                      → New:{" "}
                      {(scannedItem.locations.find((l) =>
                        scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId,
                      )?.quantity || 0) + quantity}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newStock" className="text-sm">
                      New Total
                    </Label>
                    <Input
                      id="newStock"
                      type="number"
                      value={
                        (scannedItem.locations.find((l) =>
                          scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId,
                        )?.quantity || 0) + quantity
                      }
                      onChange={(e) => {
                        const currentStock =
                          scannedItem.locations.find((l) =>
                            scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId,
                          )?.quantity || 0
                        const newTotal = Number.parseInt(e.target.value) || 0
                        setQuantity(newTotal - currentStock)
                      }}
                      className="h-12 sm:h-10 text-lg font-semibold"
                    />
                    {(scannedItem.locations.find((l) =>
                      scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId,
                    )?.quantity || 0) + quantity < 0 && (
                        <Alert variant="destructive" className="py-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">Cannot be negative</AlertDescription>
                        </Alert>
                      )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Reason</Label>
                    <Select value={adjustmentReason} onValueChange={setAdjustmentReason}>
                      <SelectTrigger className="h-10 sm:h-9">
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="returned">Return</SelectItem>
                        <SelectItem value="adjustment">Adjustment</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Note (Optional)</Label>
                    <Input
                      type="text"
                      placeholder="Add a note..."
                      value={adjustmentNote}
                      onChange={(e) => setAdjustmentNote(e.target.value)}
                      className="h-10 sm:h-9"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-2 p-4 sm:p-4 bg-muted/30 border-t flex-shrink-0">
                <Button variant="outline" onClick={handleBack} className="flex-1 h-12 sm:h-9 bg-transparent">
                  Back
                </Button>
                <Button onClick={() => setScanStep("confirm")} className="flex-1 h-12 sm:h-9 bg-primary" disabled={!adjustmentReason}>
                  Continue
                </Button>
              </div>
            </>
          ) : scanStep === "confirm" ? (
            <>
              <DialogHeader className="p-4 sm:p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-3 sm:gap-2">
                  <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 sm:h-7 sm:w-7 -ml-2">
                    <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                  <div>
                    <DialogTitle className="text-lg sm:text-base">Confirm Action</DialogTitle>
                    <DialogDescription className="text-sm sm:text-xs">Review and confirm the details</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 sm:p-4 min-h-0">
                <div className="space-y-4 sm:space-y-3">
                  {scanMode === "location" && scannedLocation ? (
                    <Alert className="border-primary/50 bg-primary/5">
                      <MapPin className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-semibold text-sm">{scannedLocation.code}</p>
                        <p className="text-sm sm:text-xs text-muted-foreground">{scannedLocation.name}</p>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {scannedItem && (
                        <Alert className="border-primary/50 bg-primary/5">
                          <Package className="h-4 w-4" />
                          <AlertDescription>
                            <p className="font-semibold text-sm">{scannedItem.name}</p>
                            <p className="text-sm sm:text-xs text-muted-foreground">{scannedItem.itemNumber}</p>
                          </AlertDescription>
                        </Alert>
                      )}

                      {(scannedLocation || selectedLocationId) && scannedItem && (
                        <Alert>
                          <MapPin className="h-4 w-4" />
                          <AlertDescription>
                            {scannedLocation ? (
                              <>
                                <p className="font-semibold text-sm">{scannedLocation.code}</p>
                                <p className="text-sm sm:text-xs text-muted-foreground">{scannedLocation.name}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-sm">
                                  {scannedItem.locations.find((l) => l.locationId === selectedLocationId)?.location.code}
                                </p>
                                <p className="text-sm sm:text-xs text-muted-foreground">
                                  {scannedItem.locations.find((l) => l.locationId === selectedLocationId)?.location.name}
                                </p>
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}

                      {(scanMode === "adjust" || scanMode === "inventory-adjustment") && (
                        <div className="p-4 sm:p-3 bg-muted/50 rounded-lg space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Adjustment:</span>
                            <span
                              className={`font-semibold text-sm ${quantity >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {quantity >= 0 ? "+" : ""}
                              {quantity} units
                            </span>
                          </div>
                          {adjustmentReason && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Reason:</span>
                              <span className="font-medium text-sm capitalize">{adjustmentReason}</span>
                            </div>
                          )}
                          {adjustmentNote && (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Note:</span>
                              <span className="font-medium text-sm">{adjustmentNote}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 sm:gap-2 p-4 sm:p-4 bg-muted/30 border-t flex-shrink-0">
                <Button variant="outline" onClick={handleBack} className="flex-1 h-12 sm:h-9 bg-transparent">
                  Back
                </Button>
                <Button onClick={handleConfirmAction} className="flex-1 h-12 sm:h-9 bg-primary">
                  Confirm
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}