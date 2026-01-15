"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRightLeft, Save, History, Edit2, Barcode, Loader2, Users, Building2, Plus, Trash2, MapPin, ImageIcon, Hash, Tag, Upload, Star, X, ExternalLink, Diff, AlertCircle, Minus, Package, ArrowDownToLine, ArrowUpFromLine, Scan, QrCode, Printer, Calendar, PackageCheck, AlertTriangle, Clock } from "lucide-react"
import { getItemByIdApi, updateItemApi, adjustStockApi, type ItemWithDetails } from "@/lib/api/items.api"
import { getLotsByItemApi, createLotApi, adjustLotQuantityApi, type LotWithRelations } from "@/lib/api/lots.api"
import { Switch } from "@/components/ui/switch"
import { getCategoriesApi, type CategoryWithCount } from "@/lib/api/categories.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getCustomersApi, type CustomerWithCount } from "@/lib/api/customers.api"
import {
  getItemImagesApi,
  smartUploadImageApi,
  setPrimaryImageApi,
  deleteItemImageApi,
  type ItemImage as APIItemImage
} from "@/lib/api/itemImages.api"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"

type TransactionWithUser = ItemWithDetails['transactions'][number]

export default function ItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string

  const [item, setItem] = useState<ItemWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])
  const [customers, setCustomers] = useState<CustomerWithCount[]>([])
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [isManageCustomersOpen, setIsManageCustomersOpen] = useState(false)
  const [newCustomerId, setNewCustomerId] = useState("")
  const [isManageLocationsOpen, setIsManageLocationsOpen] = useState(false)
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [newLocationId, setNewLocationId] = useState("")
  const [isManageImagesOpen, setIsManageImagesOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [images, setImages] = useState<APIItemImage[]>([])
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Barcode scanning state
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [verificationCount, setVerificationCount] = useState(0)
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
  const scannerElementId = "barcode-reader"
  const initAttemptRef = useRef(0)
  const verificationCodeRef = useRef<string | null>(null)
  const verificationCountRef = useRef(0)

  // Label generation state
  const [isLabelGenerateOpen, setIsLabelGenerateOpen] = useState(false)
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false)
  const [labelWidth, setLabelWidth] = useState("4")
  const [labelHeight, setLabelHeight] = useState("6")
  const [codeType, setCodeType] = useState<"qr" | "barcode" | "both">("qr")
  const [showName, setShowName] = useState(true)
  const [showDescription, setShowDescription] = useState(true)
  const [showSKU, setShowSKU] = useState(true)
  const [showUnit, setShowUnit] = useState(true)
  const [showBarcode, setShowBarcode] = useState(true)
  const [showPrice, setShowPrice] = useState(false)

  // Stock adjustment state
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    open: boolean
    locationId: string | null
    currentQuantity: number
    lotId?: string | null
  }>({
    open: false,
    locationId: null,
    currentQuantity: 0,
    lotId: null,
  })
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
  const [newStockAmount, setNewStockAmount] = useState("")
  const [adjustmentNote, setAdjustmentNote] = useState("")
  const [selectedLotForAdjustment, setSelectedLotForAdjustment] = useState<string>("")
  const [lotsAtLocation, setLotsAtLocation] = useState<LotWithRelations[]>([])

  const [lots, setLots] = useState<LotWithRelations[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)
  const [lotTracking, setLotTracking] = useState(false)
  const [isCreateLotOpen, setIsCreateLotOpen] = useState(false)
  const [isDistributeLotOpen, setIsDistributeLotOpen] = useState(false)
  const [lotFormData, setLotFormData] = useState({
    lotNumber: "",
    quantity: "",
    receivedDate: new Date().toISOString().split('T')[0],
    manufactureDate: "",
    expirationDate: "",
    supplierId: "",
    poNumber: "",
    notes: "",
  })
  const [locationAssignments, setLocationAssignments] = useState<Array<{
    locationId: string
    quantity: number
  }>>([])
  const [showAdvancedLocationSplit, setShowAdvancedLocationSplit] = useState(false)

  const [formData, setFormData] = useState({
    itemNumber: "",
    name: "",
    barcode: "",
    description: "",
    cost: "",
    unit: "",
    categoryId: "",
    supplierId: "",
  })

  useEffect(() => {
    const storedWorkspaceId = localStorage.getItem("currentWorkspaceId")
    if (storedWorkspaceId) {
      loadCategories(storedWorkspaceId)
      loadLocations(storedWorkspaceId)
      loadSuppliers(storedWorkspaceId)
      loadCustomers(storedWorkspaceId)
    }
  }, [])

  useEffect(() => {
    const loadItem = async () => {
      try {
        setLoading(true)
        const response = await getItemByIdApi(itemId)

        if (response.data?.item) {
          const itemData = response.data.item as ItemWithDetails
          setItem(itemData)

          // Set lot tracking from item data
          setLotTracking(itemData.lotTracking || false)

          setFormData({
            itemNumber: itemData.itemNumber,
            name: itemData.name,
            barcode: itemData.barcode || "",
            description: itemData.description || "",
            cost: itemData.cost.toString(),
            unit: itemData.unit || "",
            categoryId: itemData.categoryId || "",
            supplierId: itemData.supplierId || "",
          })

          const customerIds = itemData.customers?.map(c => c.customerId) || []
          setSelectedCustomerIds(customerIds)

          const locationIds = itemData.locations?.map(loc => loc.locationId) || []
          setSelectedLocationIds(locationIds)

          loadImages(itemId)

          // Load lots if lot tracking is enabled
          if (itemData.lotTracking) {
            loadLots(itemId)
          }

          // Initialize location assignments for lot creation
          if (itemData.locations && itemData.locations.length > 0) {
            setLocationAssignments(
              itemData.locations.map((loc, index) => ({
                locationId: loc.locationId,
                quantity: index === 0 ? 0 : 0, // Start with 0 for all
                enabled: index === 0, // Enable first location by default
              }))
            )
          }
        }
      } catch (error) {
        console.error("Failed to load item:", error)
        toast.error("Failed to load item")
      } finally {
        setLoading(false)
      }
    }

    if (itemId) {
      loadItem()
    }
  }, [itemId])

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  const loadImages = async (itemId: string) => {
    try {
      const response = await getItemImagesApi(itemId)
      if (response.data?.images) {
        setImages(response.data.images as APIItemImage[])
      }
    } catch (err) {
      console.error("Failed to load images:", err)
    }
  }

  const loadCategories = async (workspaceId: string) => {
    try {
      const response = await getCategoriesApi(workspaceId)
      if (response.data?.categories) {
        setCategories(response.data.categories)
      }
    } catch (err) {
      console.error("Failed to load categories:", err)
    }
  }

  const loadLocations = async (workspaceId: string) => {
    try {
      const response = await getLocationsApi(workspaceId)
      if (response.data?.locations) {
        setLocations(response.data.locations)
      }
    } catch (err) {
      console.error("Failed to load locations:", err)
    }
  }

  const handleCreateLot = async () => {
    if (!lotFormData.lotNumber || !lotFormData.quantity) {
      toast.error("Lot number and quantity are required")
      return
    }

    if (!item) {
      toast.error("Item not found")
      return
    }

    // Check if item has any locations assigned
    if (!item.locations || item.locations.length === 0) {
      toast.error("Please assign at least one location to this item first", {
        description: "Go to the Locations tab and add a storage location before creating lots.",
        duration: 5000,
      })
      return
    }

    // Initialize location assignments with all item locations set to 0
    const totalQty = parseInt(lotFormData.quantity)
    setLocationAssignments(
      item.locations.map((loc) => ({
        locationId: loc.locationId,
        quantity: 0,
      }))
    )

    // Close first modal, open second
    setIsCreateLotOpen(false)
    setIsDistributeLotOpen(true)
  }

  const handleDistributeLot = async () => {
    if (!item) return

    // Validate that location assignments match total quantity
    const totalAssigned = locationAssignments.reduce((sum, loc) => sum + loc.quantity, 0)
    const totalRequired = parseInt(lotFormData.quantity)

    if (totalAssigned !== totalRequired) {
      toast.error(`Location quantities (${totalAssigned}) must equal total quantity (${totalRequired})`)
      return
    }

    // Filter out locations with 0 quantity
    const finalLocationAssignments = locationAssignments.filter(loc => loc.quantity > 0)

    if (finalLocationAssignments.length === 0) {
      toast.error("Please assign quantity to at least one location")
      return
    }

    setIsSaving(true)
    try {
      await createLotApi(itemId, {
        lotNumber: lotFormData.lotNumber,
        quantity: parseInt(lotFormData.quantity),
        receivedDate: lotFormData.receivedDate || undefined,
        manufactureDate: lotFormData.manufactureDate || undefined,
        expirationDate: lotFormData.expirationDate || undefined,
        supplierId: lotFormData.supplierId || undefined,
        poNumber: lotFormData.poNumber || undefined,
        notes: lotFormData.notes || undefined,
        locationAssignments: finalLocationAssignments,
      })

      // Reload item data to refresh totals
      const refreshResponse = await getItemByIdApi(itemId)
      if (refreshResponse.data?.item) {
        setItem(refreshResponse.data.item as ItemWithDetails)
      }

      // Reload lots
      await loadLots(itemId)

      // Reset form
      setLotFormData({
        lotNumber: "",
        quantity: "",
        receivedDate: new Date().toISOString().split('T')[0],
        manufactureDate: "",
        expirationDate: "",
        supplierId: "",
        poNumber: "",
        notes: "",
      })
      setLocationAssignments([])

      setIsDistributeLotOpen(false)
      toast.success("Lot created successfully!")
    } catch (error) {
      console.error("Failed to create lot:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create lot")
    } finally {
      setIsSaving(false)
    }
  }

  const loadSuppliers = async (workspaceId: string) => {
    try {
      const response = await getSuppliersApi(workspaceId)
      if (response.data?.suppliers) {
        setSuppliers(response.data.suppliers)
      }
    } catch (err) {
      console.error("Failed to load suppliers:", err)
    }
  }

  const loadCustomers = async (workspaceId: string) => {
    try {
      const response = await getCustomersApi({ workspaceId, status: "ACTIVE" })
      if (response.data?.customers) {
        setCustomers(response.data.customers)
      }
    } catch (err) {
      console.error("Failed to load customers:", err)
    }
  }

  const loadLots = async (itemId: string) => {
    try {
      setLotsLoading(true)
      const response = await getLotsByItemApi(itemId)
      if (response.data?.lots) {
        setLots(response.data.lots)
      }
    } catch (err) {
      console.error("Failed to load lots:", err)
      toast.error("Failed to load lots")
    } finally {
      setLotsLoading(false)
    }
  }

  const startScanner = async () => {
    console.log("[BARCODE] Starting scanner (attempt", initAttemptRef.current + 1, ")...")
    initAttemptRef.current++

    try {
      const element = document.getElementById(scannerElementId)
      if (!element) {
        console.error("[BARCODE] Scanner element not found, retrying...")
        if (initAttemptRef.current < 5) {
          setTimeout(startScanner, 300)
        } else {
          setCameraError("Failed to initialize scanner. Please try again.")
        }
        return
      }

      html5QrcodeRef.current = new Html5Qrcode(scannerElementId)

      const config = {
        fps: 5,
        qrbox: { width: 250, height: 250 },
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

      console.log("[BARCODE] Getting cameras...")

      let cameras
      try {
        cameras = await Html5Qrcode.getCameras()
      } catch (err: any) {
        console.error("[BARCODE] Camera access error:", err)
        setCameraError("Camera access denied. Please allow camera permissions in your browser settings.")
        return
      }

      console.log("[BARCODE] Available cameras:", cameras.length)

      if (cameras.length === 0) {
        setCameraError("No cameras found. Please check your device permissions.")
        return
      }

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      let cameraConfig: any

      if (isMobile) {
        console.log("[BARCODE] Mobile device detected, using facingMode")
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
          console.log("[BARCODE] Using rear camera:", rearCamera.label)
        } else {
          console.log("[BARCODE] Using camera:", cameras[0].label)
        }
        cameraConfig = cameraId
      }

      console.log("[BARCODE] Starting camera with config:", cameraConfig)

      await html5QrcodeRef.current.start(
        cameraConfig,
        config,
        (decodedText, decodedResult) => {
          console.log(`[BARCODE] 📷 Detected: ${decodedText}`)

          if (decodedText.length < 3 || decodedText.length > 100) {
            console.log("[BARCODE] ⚠️ Rejected: Invalid length")
            return
          }

          if (verificationCodeRef.current === decodedText) {
            verificationCountRef.current++
            const newCount = verificationCountRef.current
            setVerificationCount(newCount)
            console.log(`[BARCODE] ✓ Verification ${newCount}/5`)

            if (newCount >= 5) {
              console.log("[BARCODE] ✅ VERIFIED!")

              verificationCodeRef.current = null
              verificationCountRef.current = 0
              setVerificationCode(null)
              setVerificationCount(0)
              setIsScanning(false)

              if (html5QrcodeRef.current) {
                html5QrcodeRef.current.pause(true)
              }

              // Auto-save and close
              setFormData({ ...formData, barcode: decodedText })
              stopScanner()
              setIsBarcodeScanOpen(false)
            }
          } else {
            console.log("[BARCODE] 🆕 New code, starting verification")
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
      console.log("[BARCODE] ✅ Camera started successfully")

    } catch (err: any) {
      console.error("[BARCODE] Failed to start:", err)

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
    console.log("[BARCODE] Stopping scanner...")

    if (html5QrcodeRef.current) {
      try {
        const state = html5QrcodeRef.current.getState()
        if (state === 2) {
          await html5QrcodeRef.current.stop()
          console.log("[BARCODE] Camera stopped")
        }
        await html5QrcodeRef.current.clear()
      } catch (err) {
        console.error("[BARCODE] Error stopping:", err)
      }
      html5QrcodeRef.current = null
    }

    setIsScanning(false)
  }

  const handleOpenBarcodeScanner = () => {
    setScannedBarcode(formData.barcode || "")
    setVerificationCode(null)
    setVerificationCount(0)
    setCameraError("")
    verificationCodeRef.current = null
    verificationCountRef.current = 0
    initAttemptRef.current = 0
    setIsBarcodeScanOpen(true)
    setTimeout(() => {
      startScanner()
    }, 500)
  }

  const handleCloseBarcodeScanner = () => {
    stopScanner()
    setIsBarcodeScanOpen(false)
  }

  const handleAddCustomer = () => {
    if (newCustomerId && !selectedCustomerIds.includes(newCustomerId)) {
      const updatedIds = [...selectedCustomerIds, newCustomerId]
      setSelectedCustomerIds(updatedIds)
      setNewCustomerId("")
    }
  }

  const handleRemoveCustomer = (customerId: string) => {
    const updatedIds = selectedCustomerIds.filter((id) => id !== customerId)
    setSelectedCustomerIds(updatedIds)
  }

  const handleAddLocation = () => {
    if (newLocationId && !selectedLocationIds.includes(newLocationId)) {
      const updatedIds = [...selectedLocationIds, newLocationId]
      setSelectedLocationIds(updatedIds)
      setNewLocationId("")
    }
  }

  const handleRemoveLocation = (locationId: string) => {
    const updatedIds = selectedLocationIds.filter((id) => id !== locationId)
    setSelectedLocationIds(updatedIds)
  }

  const handleUpdateCustomers = async () => {
    setIsSaving(true)
    try {
      const updateData = {
        customerIds: selectedCustomerIds,
      }

      const response = await updateItemApi(itemId, updateData)

      if (response.data?.item) {
        // Reload the full item data with all relationships including transactions
        const refreshResponse = await getItemByIdApi(itemId)
        if (refreshResponse.data?.item) {
          setItem(refreshResponse.data.item as ItemWithDetails)
        }
        setIsManageCustomersOpen(false)
        toast.success("Customers updated successfully!")
      }
    } catch (error) {
      console.error("Failed to update customers:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update customers")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateLocations = async () => {
    setIsSaving(true)
    try {
      const updateData = {
        locationIds: selectedLocationIds,
      }

      const response = await updateItemApi(itemId, updateData)

      if (response.data?.item) {
        // Reload the full item data with all relationships including transactions
        const refreshResponse = await getItemByIdApi(itemId)
        if (refreshResponse.data?.item) {
          setItem(refreshResponse.data.item as ItemWithDetails)
        }
        setIsManageLocationsOpen(false)
        toast.success("Locations updated successfully!")
      }
    } catch (error) {
      console.error("Failed to update locations:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update locations")
    } finally {
      setIsSaving(false)
    }
  }

  const openAdjustmentDialog = (locationId: string, currentQuantity: number) => {
    setAdjustmentDialog({ open: true, locationId, currentQuantity, lotId: null })
    setAdjustmentQuantity("")
    setNewStockAmount(String(currentQuantity))
    setAdjustmentNote("")
    setSelectedLotForAdjustment("")

    // If lot tracking is enabled, get lots at this location
    if (lotTracking && lots.length > 0) {
      // Include lots with 0 quantity so they can be re-stocked
      const lotsHere = lots.filter(lot =>
        lot.locations.some(loc => loc.locationId === locationId)
      )
      setLotsAtLocation(lotsHere)

      // Auto-select first lot with quantity
      if (lotsHere.length > 0) {
        setSelectedLotForAdjustment(lotsHere[0].id)
        // Set current quantity to the lot's quantity at this location
        const lotAtLocation = lotsHere[0].locations.find(loc => loc.locationId === locationId)
        if (lotAtLocation) {
          setAdjustmentDialog({
            open: true,
            locationId,
            currentQuantity: lotAtLocation.quantity,
            lotId: lotsHere[0].id
          })
          setNewStockAmount(String(lotAtLocation.quantity))
        }
      }
    }
  }

  const handleLotSelectionChange = (lotId: string) => {
    setSelectedLotForAdjustment(lotId)

    // Update current quantity based on selected lot
    const selectedLot = lotsAtLocation.find(l => l.id === lotId)
    if (selectedLot && adjustmentDialog.locationId) {
      const lotLocation = selectedLot.locations.find(
        loc => loc.locationId === adjustmentDialog.locationId
      )
      if (lotLocation) {
        setAdjustmentDialog({
          ...adjustmentDialog,
          currentQuantity: lotLocation.quantity,
          lotId: lotId,
        })
        setNewStockAmount(String(lotLocation.quantity))
        setAdjustmentQuantity("")
      }
    }
  }

  const handleAdjustmentQuantityChange = (value: string) => {
    setAdjustmentQuantity(value)
    if (value && value !== "-" && value !== "+") {
      const qty = Number.parseInt(value)
      if (!isNaN(qty)) {
        const currentStock = adjustmentDialog.currentQuantity
        setNewStockAmount(String(currentStock + qty))
      }
    }
  }

  const handleNewStockAmountChange = (value: string) => {
    setNewStockAmount(value)
    if (value) {
      const newStock = Number.parseInt(value)
      if (!isNaN(newStock)) {
        const currentStock = adjustmentDialog.currentQuantity
        const adjustment = newStock - currentStock
        setAdjustmentQuantity(String(adjustment))
      }
    } else {
      setAdjustmentQuantity("")
    }
  }

  const incrementQuantity = () => {
    const current = Number.parseInt(adjustmentQuantity || "0")
    handleAdjustmentQuantityChange(String(current + 1))
  }

  const decrementQuantity = () => {
    const current = Number.parseInt(adjustmentQuantity || "0")
    handleAdjustmentQuantityChange(String(current - 1))
  }

  const handleStockAdjustment = async () => {
    if (!adjustmentDialog.locationId || !adjustmentQuantity || adjustmentQuantity === "0") {
      return
    }

    const quantity = Number.parseInt(adjustmentQuantity)
    const isInput = quantity > 0

    try {
      // If lot tracking is enabled and a lot is selected, adjust lot quantity
      if (lotTracking && selectedLotForAdjustment) {
        await adjustLotQuantityApi(selectedLotForAdjustment, {
          type: isInput ? "INPUT" : "OUTPUT",
          quantity: Math.abs(quantity),
          reason: adjustmentNote || "Lot adjustment",
          locationId: adjustmentDialog.locationId,
        })

        // Reload lots
        await loadLots(itemId)
      } else {
        // Regular stock adjustment (non-lot-tracked items)
        await adjustStockApi(itemId, {
          type: isInput ? "INPUT" : "OUTPUT",
          quantity: Math.abs(quantity),
          reason: adjustmentNote || "Stock adjustment",
          locationId: adjustmentDialog.locationId,
        })
      }

      // Reload the full item data with all relationships including transactions
      const refreshResponse = await getItemByIdApi(itemId)
      if (refreshResponse.data?.item) {
        setItem(refreshResponse.data.item as ItemWithDetails)
      }

      toast.success("Stock updated successfully")

      setAdjustmentDialog({ open: false, locationId: null, currentQuantity: 0, lotId: null })
      setAdjustmentQuantity("")
      setNewStockAmount("")
      setAdjustmentNote("")
      setSelectedLotForAdjustment("")
      setLotsAtLocation([])
    } catch (error) {
      console.error("Failed to adjust stock:", error)
      toast.error(error instanceof Error ? error.message : "Failed to adjust stock")
    }
  }

  const handleQuickStockAdjustment = async (adjustment: number, locationId: string) => {
    try {
      const isInput = adjustment > 0
      await adjustStockApi(itemId, {
        type: isInput ? "INPUT" : "OUTPUT",
        quantity: Math.abs(adjustment),
        reason: "Quick adjustment",
        locationId: locationId,
      })

      // Reload the full item data with all relationships including transactions
      const refreshResponse = await getItemByIdApi(itemId)
      if (refreshResponse.data?.item) {
        setItem(refreshResponse.data.item as ItemWithDetails)
        toast.success(
          `${adjustment > 0 ? "Added" : "Removed"} ${Math.abs(adjustment)} unit${Math.abs(adjustment) !== 1 ? "s" : ""}`
        )
      }
    } catch (error) {
      console.error("Failed to update quantity:", error)
      toast.error("Failed to update quantity")
    }
  }


  const generateItemLabel = async () => {
    setIsGeneratingLabel(true)
    try {
      const QRCode = (await import('qrcode')).default
      const JsBarcode = (await import('jsbarcode')).default
      const { jsPDF } = await import('jspdf')

      // Parse label size from inputs
      const width = parseFloat(labelWidth) || 4
      const height = parseFloat(labelHeight) || 6

      // Validate dimensions
      if (width <= 0 || width > 12 || height <= 0 || height > 12) {
        toast.error("Label dimensions must be between 0 and 12 inches")
        setIsGeneratingLabel(false)
        return
      }

      const doc = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'in',
        format: [width, height]
      })

      // Scale-aware margins and spacing
      const scaleFactor = Math.min(width, height) / 4 // Base scale on smallest dimension
      const margin = 0.1 * scaleFactor
      const contentWidth = width - (margin * 2)
      const contentHeight = height - (margin * 2)
      let currentY = margin

      // Calculate what we need to show
      const hasHeader = showName || showDescription
      const hasFooter = showSKU || showUnit || showPrice
      const needsQR = codeType === 'qr' || codeType === 'both'
      const needsBarcode = (codeType === 'barcode' || codeType === 'both') && item.barcode
      const needsBothCodes = needsQR && needsBarcode

      // Get barcode value for QR code
      const barcodeValue = item.barcode || item.itemNumber || item.sku || `ITEM-${item.id}`

      // ========== HEADER SECTION ==========
      if (hasHeader) {
        if (showName) {
          // Scale font size based on label dimensions
          const nameFontSize = Math.max(6, Math.min(14, width * 2.5))
          doc.setFontSize(nameFontSize)
          doc.setFont('helvetica', 'bold')

          const nameLines = doc.splitTextToSize(item.name, contentWidth)
          const maxNameLines = height < 2 ? 1 : 2
          const truncatedName = nameLines.slice(0, maxNameLines)

          const lineHeight = nameFontSize * 0.012
          truncatedName.forEach((line, index) => {
            doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
          })
          currentY += lineHeight * truncatedName.length + (0.03 * scaleFactor)
        }

        if (showDescription && item.description) {
          const descFontSize = Math.max(5, Math.min(9, width * 1.8))
          doc.setFontSize(descFontSize)
          doc.setFont('helvetica', 'normal')

          const descLines = doc.splitTextToSize(item.description, contentWidth)
          const maxDescLines = height < 2 ? 1 : 1
          const truncatedDesc = descLines.slice(0, maxDescLines)

          const lineHeight = descFontSize * 0.012
          truncatedDesc.forEach((line, index) => {
            doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
          })
          currentY += lineHeight * truncatedDesc.length + (0.02 * scaleFactor)
        }

        // Add separator line after header
        if (hasHeader && (needsQR || needsBarcode || hasFooter)) {
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.003)
          doc.line(margin, currentY, width - margin, currentY)
          currentY += 0.04 * scaleFactor
        }
      }

      // ========== CALCULATE AVAILABLE SPACE FOR CODES ==========
      const footerHeight = hasFooter ? (0.25 + (0.1 * scaleFactor)) : 0
      const availableCodeHeight = height - currentY - footerHeight - margin

      // ========== CODE SECTION ==========
      if (needsQR || needsBarcode) {
        const codeStartY = currentY

        if (needsBothCodes) {
          // BOTH QR AND BARCODE - Stacked vertically
          const verticalSpacing = 0.08 * scaleFactor

          // Calculate sizes for stacked layout
          const qrSize = Math.min(
            contentWidth * 0.65,
            (availableCodeHeight - verticalSpacing) * 0.5,
            width * 0.5
          )

          const barcodeHeight = Math.min(
            (availableCodeHeight - verticalSpacing - qrSize) * 0.8,
            height * 0.2
          )

          // QR Code on top - centered
          const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, {
            width: 200,
            margin: 0,
            errorCorrectionLevel: 'M'
          })

          const qrX = (width - qrSize) / 2
          const qrY = codeStartY + ((availableCodeHeight - qrSize - barcodeHeight - verticalSpacing) / 2)
          doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

          // Barcode below QR - centered
          const canvas = document.createElement('canvas')
          try {
            const barcodeCanvasHeight = Math.min(60, Math.max(30, height * 15))
            const barcodeCanvasWidth = Math.max(1.5, width * 0.5)

            JsBarcode(canvas, barcodeValue, {
              format: 'CODE128',
              width: barcodeCanvasWidth,
              height: barcodeCanvasHeight,
              displayValue: showBarcode,
              fontSize: Math.max(8, Math.min(12, width * 2.5)),
              textMargin: 2,
              margin: 0
            })

            const barcodeDataUrl = canvas.toDataURL('image/png')
            const barcodeDisplayWidth = contentWidth * 0.8
            const barcodeX = (width - barcodeDisplayWidth) / 2
            const barcodeY = qrY + qrSize + verticalSpacing

            doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeDisplayWidth, barcodeHeight)
          } catch (err) {
            console.error('Barcode generation failed:', err)
          }

        } else if (needsQR) {
          // QR CODE ONLY - Centered, properly sized
          const maxQRSize = Math.min(
            contentWidth * 0.65,
            availableCodeHeight * 0.85,
            Math.max(width, height) * 0.5
          )

          // Generate compact QR Code
          const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, {
            width: 250,
            margin: 0,
            errorCorrectionLevel: 'M'
          })

          const qrX = (width - maxQRSize) / 2
          const qrY = codeStartY + ((availableCodeHeight - maxQRSize) / 2)
          doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, maxQRSize, maxQRSize)

        } else if (needsBarcode) {
          // BARCODE ONLY - Centered and full width
          const canvas = document.createElement('canvas')
          try {
            const barcodeHeight = Math.min(80, Math.max(30, height * 20))
            const barcodeWidth = Math.max(1.5, width * 0.5)

            JsBarcode(canvas, barcodeValue, {
              format: 'CODE128',
              width: barcodeWidth,
              height: barcodeHeight,
              displayValue: showBarcode,
              fontSize: Math.max(10, Math.min(16, width * 3)),
              textMargin: 2,
              margin: 0
            })

            const barcodeDataUrl = canvas.toDataURL('image/png')
            const barcodeDisplayWidth = contentWidth * 0.85
            const barcodeDisplayHeight = Math.min(availableCodeHeight * 0.7, height * 0.35)
            const barcodeX = (width - barcodeDisplayWidth) / 2
            const barcodeY = codeStartY + ((availableCodeHeight - barcodeDisplayHeight) / 2)

            doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeDisplayWidth, barcodeDisplayHeight)
          } catch (err) {
            console.error('Barcode generation failed:', err)
          }
        }

        currentY = height - footerHeight - margin
      }

      // ========== FOOTER SECTION ==========
      if (hasFooter) {
        // Add separator line before footer
        if (needsQR || needsBarcode) {
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.003)
          doc.line(margin, currentY, width - margin, currentY)
          currentY += 0.03 * scaleFactor
        }

        const fontSize = Math.max(5, Math.min(9, width * 1.8))
        doc.setFontSize(fontSize)
        const lineHeight = fontSize * 0.012

        // Count active fields to determine layout
        const activeFields = [showSKU, showUnit, showPrice].filter(Boolean).length

        if (activeFields === 1) {
          // Single field - centered
          doc.setFont('helvetica', 'bold')
          if (showSKU) {
            doc.text('SKU:', width / 2, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            const skuText = String(item.itemNumber || item.sku)
            const skuLines = doc.splitTextToSize(skuText, contentWidth * 0.9)
            doc.text(skuLines[0], width / 2, currentY + lineHeight * 2, { align: 'center' })
          } else if (showUnit) {
            doc.text('Unit:', width / 2, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(item.unit || 'EA', width / 2, currentY + lineHeight * 2, { align: 'center' })
          } else if (showPrice) {
            doc.text('Price:', width / 2, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(`$${(item.unitPrice || item.cost || 0).toFixed(2)}`, width / 2, currentY + lineHeight * 2, { align: 'center' })
          }
        } else if (activeFields === 2) {
          // Two fields - side by side
          const colWidth = contentWidth / 2
          let col = 0

          if (showSKU) {
            const xPos = margin + (col * colWidth) + (colWidth / 2)
            doc.setFont('helvetica', 'bold')
            doc.text('SKU:', xPos, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            const skuText = String(item.itemNumber || item.sku)
            const skuLines = doc.splitTextToSize(skuText, colWidth * 0.85)
            doc.text(skuLines[0], xPos, currentY + lineHeight * 2, { align: 'center' })
            col++
          }
          if (showUnit) {
            const xPos = margin + (col * colWidth) + (colWidth / 2)
            doc.setFont('helvetica', 'bold')
            doc.text('Unit:', xPos, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(item.unit || 'EA', xPos, currentY + lineHeight * 2, { align: 'center' })
            col++
          }
          if (showPrice && col < 2) {
            const xPos = margin + (col * colWidth) + (colWidth / 2)
            doc.setFont('helvetica', 'bold')
            doc.text('Price:', xPos, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(`$${(item.unitPrice || item.cost || 0).toFixed(2)}`, xPos, currentY + lineHeight * 2, { align: 'center' })
          }
        } else if (activeFields === 3) {
          // Three fields - use abbreviations for small labels
          const colWidth = contentWidth / 3

          if (showSKU) {
            const xPos = margin + (colWidth / 2)
            doc.setFont('helvetica', 'bold')
            doc.text('SKU', xPos, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            const skuText = String(item.itemNumber || item.sku)
            const skuLines = doc.splitTextToSize(skuText, colWidth * 0.85)
            doc.text(skuLines[0], xPos, currentY + lineHeight * 2, { align: 'center' })
          }

          if (showUnit) {
            const xPos = margin + colWidth + (colWidth / 2)
            doc.setFont('helvetica', 'bold')
            doc.text('Unit', xPos, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(item.unit || 'EA', xPos, currentY + lineHeight * 2, { align: 'center' })
          }

          if (showPrice) {
            const xPos = margin + (colWidth * 2) + (colWidth / 2)
            doc.setFont('helvetica', 'bold')
            doc.text('Price', xPos, currentY + lineHeight, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(`$${(item.unitPrice || item.cost || 0).toFixed(2)}`, xPos, currentY + lineHeight * 2, { align: 'center' })
          }
        }
      }

      // Add a subtle border around the entire label
      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.005)
      doc.rect(0.02, 0.02, width - 0.04, height - 0.04)

      // Save PDF
      const itemIdentifier = item.itemNumber || item.sku || item.id
      const timestamp = new Date().toISOString().slice(0, 10)
      doc.save(`label-${itemIdentifier}-${width}x${height}-${timestamp}.pdf`)
      toast.success("Label generated successfully!")
      setIsLabelGenerateOpen(false)
    } catch (error) {
      console.error("Failed to generate label:", error)
      toast.error("Failed to generate label. Please try again.")
    } finally {
      setIsGeneratingLabel(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.cost || !formData.itemNumber.trim()) {
      toast.error("Item number, name, and cost are required")
      return
    }

    setIsSaving(true)
    try {
      const updateData = {
        itemNumber: formData.itemNumber,
        name: formData.name,
        barcode: formData.barcode || undefined,
        description: formData.description || undefined,
        cost: parseFloat(formData.cost),
        unit: formData.unit || undefined,
        categoryId: formData.categoryId || undefined,
        supplierId: formData.supplierId || undefined,
        customerIds: selectedCustomerIds,
        lotTracking: lotTracking,
      }

      const response = await updateItemApi(itemId, updateData)

      if (response.data?.item) {
        setItem(response.data.item as ItemWithDetails)
        setIsEditing(false)
        toast.success("Item updated successfully")
      }
    } catch (error) {
      console.error("Failed to update item:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update item")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (item) {
      setFormData({
        itemNumber: item.itemNumber,
        name: item.name,
        barcode: item.barcode || "",
        description: item.description || "",
        cost: item.cost.toString(),
        unit: item.unit || "",
        categoryId: item.categoryId || "",
        supplierId: item.supplierId || "",
      })
      const customerIds = item.customers?.map(c => c.customerId) || []
      setSelectedCustomerIds(customerIds)
      const locationIds = item.locations?.map(loc => loc.locationId) || []
      setSelectedLocationIds(locationIds)
    }
    setIsEditing(false)
  }

  const handleOpenManageCustomers = () => {
    const currentCustomerIds = item?.customers?.map(c => c.customerId) || []
    setSelectedCustomerIds(currentCustomerIds)
    setNewCustomerId("")
    setIsManageCustomersOpen(true)
  }

  const handleOpenManageLocations = () => {
    const currentLocationIds = item?.locations?.map(loc => loc.locationId) || []
    setSelectedLocationIds(currentLocationIds)
    setNewLocationId("")
    setIsManageLocationsOpen(true)
  }

  const handleSetPrimaryImage = async (imageId: string) => {
    try {
      await setPrimaryImageApi(imageId)
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          isPrimary: img.id === imageId,
        })),
      )
      toast.success("Primary image updated")
    } catch (error) {
      console.error("Failed to set primary image:", error)
      toast.error("Failed to set primary image")
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    try {
      await deleteItemImageApi(imageId)
      setImages((prev) => prev.filter((img) => img.id !== imageId))
      toast.success("Image deleted")
    } catch (error) {
      console.error("Failed to delete image:", error)
      toast.error("Failed to delete image")
    }
  }

  const handleUploadImages = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/jpeg,image/png,image/gif,image/webp"
    input.multiple = true
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      setIsUploadingImage(true)
      setUploadProgress(0)

      try {
        const isPrimary = images.length === 0

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const isFirst = i === 0

          await smartUploadImageApi(
            itemId,
            file,
            isPrimary && isFirst,
            (progress) => {
              setUploadProgress(Math.round(((i + progress / 100) / files.length) * 100))
            }
          )
        }

        await loadImages(itemId)
        toast.success(`${files.length} image(s) uploaded successfully`)
      } catch (error) {
        console.error("Failed to upload images:", error)
        toast.error("Failed to upload images")
      } finally {
        setIsUploadingImage(false)
        setUploadProgress(0)
      }
    }
    input.click()
  }

  type LotStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'QUARANTINED' | 'RECALLED';

  const getLotStatusBadge = (status: LotStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500">Active</Badge>
      case 'DEPLETED':
        return <Badge variant="secondary">Depleted</Badge>
      case 'EXPIRED':
        return <Badge variant="destructive">Expired</Badge>
      case 'QUARANTINED':
        return <Badge className="bg-yellow-500">Quarantined</Badge>
      case 'RECALLED':
        return <Badge variant="destructive">Recalled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getDaysUntilExpiration = (expirationDate: string | null) => {
    if (!expirationDate) return null
    const now = new Date()
    const expDate = new Date(expirationDate)
    const diffTime = expDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getExpirationWarning = (expirationDate: string | null) => {
    const days = getDaysUntilExpiration(expirationDate)
    if (days === null) return null

    if (days < 0) return { color: 'text-red-600', text: 'Expired', icon: AlertTriangle }
    if (days <= 30) return { color: 'text-orange-500', text: `${days} days`, icon: AlertTriangle }
    if (days <= 60) return { color: 'text-yellow-600', text: `${days} days`, icon: Clock }
    return { color: 'text-muted-foreground', text: `${days} days`, icon: Calendar }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading item details...</p>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Item Not Found</CardTitle>
            <CardDescription>The item you&apos;re looking for doesn&apos;t exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedCustomers = customers.filter(c => selectedCustomerIds.includes(c.id))
  const itemLocationsWithDetails = item.locations?.map(itemLoc => {
    const locationDetails = locations.find(l => l.id === itemLoc.locationId)
    return {
      ...itemLoc,
      location: locationDetails || itemLoc.location
    }
  }) || []

  const totalQuantity = itemLocationsWithDetails.reduce((sum, loc) => sum + (loc.quantity || 0), 0)
  const primaryImage = images.find((img) => img.isPrimary)
  const primaryImageUrl = primaryImage ? `/api/items/images/image/${primaryImage.id}` : null

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsLabelGenerateOpen(true)} className="gap-2">
                  <QrCode className="h-4 w-4" />
                  <span className="hidden sm:inline">Label</span>
                </Button>
                <Button onClick={() => setIsEditing(true)} className="shadow-sm gap-2">
                  <Edit2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} className="shadow-sm gap-2" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 pt-4 sm:pt-6">
        {/* Hero Section */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              {/* Product Image */}
              <div className="flex-shrink-0">
                <div
                  className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center ${isEditing
                    ? "cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    : primaryImageUrl
                      ? "cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      : ""
                    }`}
                  onClick={() => {
                    if (isEditing) {
                      setIsManageImagesOpen(true)
                    } else if (primaryImageUrl) {
                      setSelectedImageUrl(primaryImageUrl)
                    }
                  }}
                >
                  {primaryImageUrl ? (
                    <>
                      <img
                        src={primaryImageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {isEditing && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Package className="h-8 w-8" />
                      {isEditing && <span className="text-xs">Upload</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Item Info */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="text-2xl font-bold h-auto py-2 mb-3 border-dashed"
                    placeholder="Enter item name"
                  />
                ) : (
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{item.name}</h1>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge
                    variant={
                      item.status === "IN_STOCK" ? "default" : item.status === "LOW_STOCK" ? "secondary" : "destructive"
                    }
                  >
                    {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                  </Badge>
                  <Badge variant="outline">
                    {typeof item.category === 'string'
                      ? item.category
                      : item.category?.name || "Uncategorized"}
                  </Badge>
                  {lotTracking && (
                    <Badge className="bg-blue-500 hover:bg-blue-600">
                      <PackageCheck className="h-3 w-3 mr-1" />
                      Lot Tracked
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">SKU</p>
                    <p className="text-sm font-semibold">{item.itemNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Barcode</p>
                    <p className="text-sm font-semibold">{item.barcode || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Stock</p>
                    <p className="text-sm font-semibold text-primary">{totalQuantity} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Unit Price</p>
                    <p className="text-sm font-semibold">${item.cost.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="details" className="mt-4 sm:mt-6 gap-0">
          <div className="bg-card border rounded-t-lg">
            <TabsList className={`w-full grid ${lotTracking ? 'grid-cols-4' : 'grid-cols-3'} h-auto p-0 bg-transparent border-0px rounded-none`}>
              <TabsTrigger
                value="details"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="locations"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
              >
                Locations
              </TabsTrigger>
              {lotTracking && (
                <TabsTrigger
                  value="lots"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                >
                  Lots ({lots.filter(l => l.status === 'ACTIVE').length})
                </TabsTrigger>
              )}
              <TabsTrigger
                value="history"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
              >
                History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-0">
            <div className="bg-card p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Item Details Card */}
                  <div className="bg-card border rounded-lg p-4">
                    <h3 className="text-base font-semibold mb-4">Item Information</h3>
                    {isEditing && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="h-4 w-4 text-blue-600" />
                          <div>
                            <Label htmlFor="lotTracking" className="text-sm font-medium">Enable Lot Tracking</Label>
                            <p className="text-xs text-muted-foreground">Track batches with expiration dates</p>
                          </div>
                        </div>
                        <Switch
                          id="lotTracking"
                          checked={lotTracking}
                          onCheckedChange={setLotTracking}
                        />
                      </div>
                    )}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="itemNumber" className="text-xs text-muted-foreground">Item Number</Label>
                          {isEditing ? (
                            <Input
                              id="itemNumber"
                              value={formData.itemNumber}
                              onChange={(e) => setFormData({ ...formData, itemNumber: e.target.value })}
                              className="font-mono h-9"
                              placeholder="Enter item number"
                            />
                          ) : (
                            <div className="text-sm font-medium font-mono">{item.itemNumber}</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="barcode" className="text-xs text-muted-foreground">Barcode</Label>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input
                                id="barcode"
                                value={formData.barcode}
                                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                className="font-mono h-9 flex-1"
                                placeholder="Enter barcode"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2"
                                onClick={handleOpenBarcodeScanner}
                              >
                                <Scan className="h-4 w-4" />
                                <span className="hidden sm:inline">Scan</span>
                              </Button>
                            </div>
                          ) : (
                            <div className="text-sm font-medium font-mono">{item.barcode || "—"}</div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="category" className="text-xs text-muted-foreground">Category</Label>
                          {isEditing ? (
                            <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                              <SelectTrigger id="category" className="h-9">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm font-medium">{item.category?.name || "Uncategorized"}</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplier" className="text-xs text-muted-foreground">Supplier</Label>
                          {isEditing ? (
                            <Select value={formData.supplierId} onValueChange={(value) => setFormData({ ...formData, supplierId: value })}>
                              <SelectTrigger id="supplier" className="h-9">
                                <SelectValue placeholder="Select supplier" />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliers.map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm font-medium flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {item.supplier?.name || "Unknown"}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cost" className="text-xs text-muted-foreground">Unit Cost</Label>
                          {isEditing ? (
                            <Input
                              id="cost"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.cost}
                              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                              className="h-9"
                              placeholder="Enter unit cost"
                            />
                          ) : (
                            <div className="text-sm font-medium">${item.cost.toFixed(2)}</div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unit" className="text-xs text-muted-foreground">Unit</Label>
                          {isEditing ? (
                            <Input
                              id="unit"
                              value={formData.unit}
                              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                              className="h-9"
                              placeholder="e.g., EA, BOX, KG"
                            />
                          ) : (
                            <div className="text-sm font-medium">{item.unit || "—"}</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-xs text-muted-foreground">Description</Label>
                        {isEditing ? (
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder="Enter description"
                          />
                        ) : (
                          <div className="text-sm">{item.description || "—"}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Product Images Card */}
                  <div className="bg-card border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold">Product Images</h3>
                      <Button variant="outline" size="sm" onClick={() => setIsManageImagesOpen(true)} className="gap-2">
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline">Manage</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {images.map((image) => (
                        <div
                          key={image.id}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-pointer"
                          onClick={() => setSelectedImageUrl(`/api/items/images/image/${image.id}`)}
                        >
                          <img
                            src={`/api/items/images/image/${image.id}`}
                            alt="Product"
                            className="w-full h-full object-cover"
                          />
                          {image.isPrimary && (
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white shadow-lg border-0 text-xs">
                                <Star className="h-2 w-2 mr-0.5 fill-current" />
                                Primary
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                      {images.length === 0 && (
                        <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center col-span-3">
                          <div className="text-center p-4">
                            <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">No images yet</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  {/* Quick Stats */}
                  <div className="bg-card border rounded-lg p-4">
                    <h3 className="text-base font-semibold mb-4">Quick Stats</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Value</span>
                        <span className="text-sm font-semibold">${(totalQuantity * item.cost).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Locations</span>
                        <span className="text-sm font-semibold">{itemLocationsWithDetails.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Movements</span>
                        <span className="text-sm font-semibold">{item.transactions?.length || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Linked Customers</span>
                        <span className="text-sm font-semibold">{item.customers?.length || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customers */}
                  <div className="bg-card border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold">Customers</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleOpenManageCustomers}
                        disabled={isEditing}
                      >
                        Manage
                      </Button>
                    </div>
                    {item.customers && item.customers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {item.customers.map((customerLink) => (
                          <Badge key={customerLink.id} variant="secondary" className="text-xs">
                            {customerLink.customer.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No customers assigned</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="mt-0">
            <div className="bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Storage Locations</h3>
                <Button variant="outline" size="sm" onClick={handleOpenManageLocations} className="gap-2 h-7">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Manage</span>
                </Button>
              </div>
              {itemLocationsWithDetails.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed rounded-lg">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium text-muted-foreground">No locations assigned</p>
                  <p className="text-xs text-muted-foreground mt-1">Click Manage to assign storage locations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itemLocationsWithDetails
                    .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
                    .map((itemLocation) => (
                      <div
                        key={itemLocation.id}
                        className="group flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 hover:border-accent/50 transition-all"
                      >
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => router.push(`/dashboard/locations/${itemLocation.locationId}`)}
                        >
                          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-5 w-5 text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold font-mono text-sm truncate">
                                {itemLocation.location.code}
                              </h3>
                              {(itemLocation.quantity || 0) === 0 && (
                                <Badge variant="secondary" className="text-xs py-0">Empty</Badge>
                              )}
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {itemLocation.notes && (
                              <p className="text-xs text-muted-foreground truncate">{itemLocation.notes}</p>
                            )}
                            {(itemLocation.minStock > 0 || itemLocation.maxStock > 0) && (
                              <div className="flex items-center gap-2 mt-1">
                                {itemLocation.minStock > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    Min: {itemLocation.minStock}
                                  </span>
                                )}
                                {itemLocation.maxStock > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    Max: {itemLocation.maxStock}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-0">Quantity</p>
                            <p className="text-xl font-bold text-accent">
                              {itemLocation.quantity || 0}
                              {item.unit && <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 hover:bg-accent/10 hover:text-accent hover:border-accent/50"
                              onClick={(e) => {
                                e.stopPropagation()
                                openAdjustmentDialog(itemLocation.locationId, itemLocation.quantity || 0)
                              }}
                            >
                              <Diff className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (confirm(`Remove this item from location ${itemLocation.location.code}? This action cannot be undone.`)) {
                                  try {
                                    const updatedLocationIds = selectedLocationIds.filter(id => id !== itemLocation.locationId)
                                    setSelectedLocationIds(updatedLocationIds)

                                    const response = await updateItemApi(itemId, {
                                      locationIds: updatedLocationIds,
                                    })

                                    if (response.data?.item) {
                                      setItem(response.data.item as ItemWithDetails)
                                      toast.success(`Item removed from location ${itemLocation.location.code}`)
                                    }
                                  } catch (error) {
                                    console.error("Failed to remove location:", error)
                                    toast.error("Failed to remove location")
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Lots Tab */}
          {lotTracking && (
            <TabsContent value="lots" className="mt-0">
              <div className="bg-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold">Lot / Batch Tracking</h3>
                    <p className="text-xs text-muted-foreground">Track inventory by production batch or lot number</p>
                  </div>
                  <Button onClick={() => setIsCreateLotOpen(true)} className="gap-2 h-8">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New Lot</span>
                  </Button>
                </div>

                {lots.length === 0 ? (
                  <div className="text-center py-12 px-4 border border-dashed rounded-lg">
                    <PackageCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium text-muted-foreground">No lots created yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first lot to start tracking batches</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lots
                      .sort((a, b) => {
                        if (a.expirationDate && b.expirationDate) {
                          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
                        }
                        if (a.expirationDate) return -1
                        if (b.expirationDate) return 1
                        return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime()
                      })
                      .map((lot) => {
                        const expirationWarning = getExpirationWarning(lot.expirationDate)
                        const IconComponent = expirationWarning?.icon || Calendar

                        return (
                          <div
                            key={lot.id}
                            className="group p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 hover:border-accent/50 transition-all cursor-pointer"
                            onClick={() => router.push(`/dashboard/items/${itemId}/lot/${lot.id}`)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold font-mono text-sm">{lot.lotNumber}</h4>
                                  {getLotStatusBadge(lot.status)}
                                  {expirationWarning && lot.status === 'ACTIVE' && (
                                    <Badge variant="outline" className={`${expirationWarning.color} border-current text-xs`}>
                                      <IconComponent className="h-2.5 w-2.5 mr-1" />
                                      {expirationWarning.text}
                                    </Badge>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
                                  <div>
                                    <p className="text-muted-foreground">Quantity</p>
                                    <p className="font-semibold">{lot.quantity} / {lot.initialQuantity}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Received</p>
                                    <p className="font-semibold">{new Date(lot.receivedDate).toLocaleDateString()}</p>
                                  </div>
                                  {lot.expirationDate && (
                                    <div>
                                      <p className="text-muted-foreground">Expires</p>
                                      <p className="font-semibold">{new Date(lot.expirationDate).toLocaleDateString()}</p>
                                    </div>
                                  )}
                                  {lot.supplier && (
                                    <div>
                                      <p className="text-muted-foreground">Supplier</p>
                                      <p className="font-semibold truncate">{lot.supplier.name}</p>
                                    </div>
                                  )}
                                </div>

                                {lot.locations.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {lot.locations.map((loc) => (
                                      <Badge key={loc.id} variant="secondary" className="text-xs font-mono">
                                        {loc.locationCode}: {loc.quantity}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                {lot.notes && (
                                  <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{lot.notes}</p>
                                )}
                              </div>

                              <div className="text-right flex-shrink-0">
                                <div className="text-2xl font-bold text-primary">
                                  {lot.quantity}
                                  {item.unit && <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {Math.round((lot.quantity / lot.initialQuantity) * 100)}% remaining
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* History Tab */}
          <TabsContent value="history" className="mt-0">
            <div className="bg-card overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-base font-semibold">Transaction History</h3>
              </div>
              {item.transactions && item.transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Details</TableHead>
                        <TableHead className="text-xs text-right">Qty</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">User</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.transactions.slice(0, 20).map((transaction: TransactionWithUser) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded ${transaction.type === "INPUT"
                                ? "bg-green-50"
                                : transaction.type === "OUTPUT"
                                  ? "bg-red-50"
                                  : "bg-blue-50"
                                }`}>
                                {transaction.type === "TRANSFER" ? (
                                  <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />
                                ) : (
                                  <History className={`h-3.5 w-3.5 ${transaction.type === "INPUT" ? "text-green-600" : "text-red-600"
                                    }`} />
                                )}
                              </div>
                              <span className="text-sm hidden md:inline">
                                {transaction.type === "INPUT"
                                  ? "Stock Added"
                                  : transaction.type === "OUTPUT"
                                    ? "Stock Removed"
                                    : "Transfer"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {transaction.type === "TRANSFER" ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="text-muted-foreground">To:</span>
                                  <code className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">
                                    {transaction.toLocation?.code || "Unknown"}
                                  </code>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="text-muted-foreground">From:</span>
                                  <code className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">
                                    {transaction.fromLocation?.code || "Unknown"}
                                  </code>
                                </div>
                                {transaction.reason && !transaction.reason.startsWith("Transfer:") && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                                    {transaction.reason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {transaction.fromLocationId && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-muted-foreground">Location:</span>
                                    <code className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">
                                      {transaction.fromLocation?.code || transaction.toLocation?.code || "Unknown"}
                                    </code>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {transaction.reason || "—"}
                                </p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`text-sm font-semibold ${transaction.type === "INPUT"
                                ? "text-green-600"
                                : transaction.type === "OUTPUT"
                                  ? "text-red-600"
                                  : "text-blue-600"
                                }`}
                            >
                              {transaction.type === "INPUT"
                                ? "+"
                                : transaction.type === "OUTPUT"
                                  ? "-"
                                  : ""}
                              {transaction.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {transaction.user?.name || "Unknown User"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium text-muted-foreground">No transaction history</p>
                  <p className="text-xs text-muted-foreground mt-1">Transactions will appear here as they occur</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Barcode Scanner Dialog */}
      <Dialog open={isBarcodeScanOpen} onOpenChange={handleCloseBarcodeScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
            <DialogDescription>Position the barcode within the frame</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Camera Scanner */}
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div id={scannerElementId} className="w-full h-full" />
              )}
            </div>

            {/* Verification Progress - Only show counter, no scan history */}
            {verificationCount > 0 && !cameraError && (
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-sm font-semibold text-green-500">
                  Verifying {verificationCount}/5
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseBarcodeScanner} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Label Generation Dialog */}
      <Dialog open={isLabelGenerateOpen} onOpenChange={setIsLabelGenerateOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <QrCode className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              Generate Item Label
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Generate a printable label with QR code and barcode for this item.
            </DialogDescription>
          </DialogHeader>

          {/* Label Preview and Controls */}
          <div className="space-y-2 py-0">
            {/* Label Preview */}
            <div className="border-2 border-dashed rounded-lg p-2 sm:p-3 bg-white text-black overflow-hidden">
              <div className="space-y-1.5 sm:space-y-2">
                {/* Header Section */}
                {(showName || showDescription) && (
                  <div className="text-center border-b border-gray-300 pb-1.5">
                    {showName && (
                      <h3 className="font-bold text-xs sm:text-sm line-clamp-1">
                        {item.name}
                      </h3>
                    )}
                    {showDescription && (
                      <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-1 mt-0.5">
                        {item.description || "No description"}
                      </p>
                    )}
                  </div>
                )}

                {/* Code Display Section */}
                {(codeType === "qr" || codeType === "barcode" || codeType === "both") && (
                  <>
                    {codeType === "both" ? (
                      // Both codes stacked
                      <div className="flex flex-col items-center gap-2 py-1">
                        <div className="w-24 h-24 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                          <div className="text-center">
                            <QrCode className="h-10 w-10 mx-auto text-gray-400" />
                            <p className="text-[8px] text-gray-500 mt-0.5">QR</p>
                          </div>
                        </div>
                        {item.barcode && (
                          <div className="w-32 h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                            <div className="text-center w-full px-2">
                              <Barcode className="h-8 w-8 mx-auto text-gray-400" />
                              <p className="text-[8px] text-gray-500 mt-0.5">Barcode</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : codeType === "qr" ? (
                      // QR only
                      <div className="flex justify-center py-1">
                        <div className="w-32 h-32 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                          <div className="text-center">
                            <QrCode className="h-16 w-16 mx-auto text-gray-400" />
                            <p className="text-[10px] text-gray-500 mt-1">QR Code</p>
                          </div>
                        </div>
                      </div>
                    ) : item.barcode ? (
                      // Barcode only
                      <div className="py-1">
                        <div className="h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50 w-full">
                          <div className="text-center w-full px-2">
                            <Barcode className="h-10 w-10 mx-auto text-gray-400" />
                            {showBarcode && (
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.barcode}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                {/* Footer Section */}
                {(showSKU || showUnit || showPrice) && (
                  <div className="border-t border-gray-300 pt-1.5 text-[10px]">
                    {(() => {
                      const activeFields = [showSKU, showUnit, showPrice].filter(Boolean).length

                      if (activeFields === 1) {
                        return (
                          <div className="text-center">
                            {showSKU && (
                              <div>
                                <p className="text-gray-600 font-medium">SKU:</p>
                                <p className="font-mono font-semibold truncate">{item.itemNumber || item.sku}</p>
                              </div>
                            )}
                            {showUnit && (
                              <div>
                                <p className="text-gray-600 font-medium">Unit:</p>
                                <p className="font-semibold truncate">{item.unit || "EA"}</p>
                              </div>
                            )}
                            {showPrice && (
                              <div>
                                <p className="text-gray-600 font-medium">Price:</p>
                                <p className="font-semibold">${(item.unitPrice || item.cost || 0).toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                        )
                      } else if (activeFields === 2) {
                        return (
                          <div className="grid grid-cols-2 gap-1 text-center">
                            {showSKU && (
                              <div>
                                <p className="text-gray-600 font-medium">SKU:</p>
                                <p className="font-mono font-semibold truncate px-1">{item.itemNumber || item.sku}</p>
                              </div>
                            )}
                            {showUnit && (
                              <div>
                                <p className="text-gray-600 font-medium">Unit:</p>
                                <p className="font-semibold truncate px-1">{item.unit || "EA"}</p>
                              </div>
                            )}
                            {showPrice && (
                              <div>
                                <p className="text-gray-600 font-medium">Price:</p>
                                <p className="font-semibold">${(item.unitPrice || item.cost || 0).toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                        )
                      } else {
                        return (
                          <div className="grid grid-cols-3 gap-1 text-center">
                            {showSKU && (
                              <div>
                                <p className="text-gray-600 font-medium">SKU</p>
                                <p className="font-mono font-semibold truncate text-[8px]">{item.itemNumber || item.sku}</p>
                              </div>
                            )}
                            {showUnit && (
                              <div>
                                <p className="text-gray-600 font-medium">Unit</p>
                                <p className="font-semibold truncate text-[8px]">{item.unit || "EA"}</p>
                              </div>
                            )}
                            {showPrice && (
                              <div>
                                <p className="text-gray-600 font-medium">Price</p>
                                <p className="font-semibold text-[8px]">${(item.unitPrice || item.cost || 0).toFixed(2)}</p>
                              </div>
                            )}
                          </div>
                        )
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {/* Compact Size and Code Type - All on one line */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Label Configuration</Label>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="labelWidth" className="text-[10px] text-muted-foreground">
                      Width (in)
                    </Label>
                    <Input
                      id="labelWidth"
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="12"
                      value={labelWidth}
                      onChange={(e) => setLabelWidth(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="4"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="labelHeight" className="text-[10px] text-muted-foreground">
                      Height (in)
                    </Label>
                    <Input
                      id="labelHeight"
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="12"
                      value={labelHeight}
                      onChange={(e) => setLabelHeight(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="6"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="codeType" className="text-[10px] text-muted-foreground">
                      Code Type
                    </Label>
                    <Select value={codeType} onValueChange={(value: any) => setCodeType(value)}>
                      <SelectTrigger id="codeType" className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qr" className="text-xs">
                          QR Only
                        </SelectItem>
                        <SelectItem value="barcode" className="text-xs">
                          Barcode Only
                        </SelectItem>
                        {/* <SelectItem value="both" className="text-xs">
                          Both (Stacked)
                        </SelectItem> */}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Compact Field toggles */}
              <div className="border rounded-lg p-2 bg-muted/30 space-y-1">
                <Label className="text-xs font-semibold">Label Fields</Label>
                <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showName" className="text-[14px] font-normal cursor-pointer">
                      Name
                    </Label>
                    <Switch id="showName" checked={showName} onCheckedChange={setShowName} className="scale-[0.65]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showDescription" className="text-[14px] font-normal cursor-pointer">
                      Desc
                    </Label>
                    <Switch
                      id="showDescription"
                      checked={showDescription}
                      onCheckedChange={setShowDescription}
                      className="scale-[0.65]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showSKU" className="text-[14px] font-normal cursor-pointer">
                      SKU
                    </Label>
                    <Switch id="showSKU" checked={showSKU} onCheckedChange={setShowSKU} className="scale-[0.65]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showUnit" className="text-[14px] font-normal cursor-pointer">
                      Unit
                    </Label>
                    <Switch
                      id="showUnit"
                      checked={showUnit}
                      onCheckedChange={setShowUnit}
                      className="scale-[0.65]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showBarcode" className="text-[14px] font-normal cursor-pointer">
                      Code #
                    </Label>
                    <Switch
                      id="showBarcode"
                      checked={showBarcode}
                      onCheckedChange={setShowBarcode}
                      className="scale-[0.65]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showPrice" className="text-[14px] font-normal cursor-pointer">
                      Price
                    </Label>
                    <Switch id="showPrice" checked={showPrice} onCheckedChange={setShowPrice} className="scale-[0.65]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsLabelGenerateOpen(false)}
              className="h-8 text-xs"
              disabled={isGeneratingLabel}
            >
              Cancel
            </Button>
            <Button
              onClick={generateItemLabel}
              disabled={isGeneratingLabel}
              className="gap-2 h-8 text-xs"
            >
              {isGeneratingLabel ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="h-3 w-3" />
                  Print Label
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog
        open={adjustmentDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustmentDialog({ open: false, locationId: null, currentQuantity: 0, lotId: null })
            setAdjustmentQuantity("")
            setNewStockAmount("")
            setAdjustmentNote("")
            setSelectedLotForAdjustment("")
            setLotsAtLocation([])
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base">
              {lotTracking ? "Adjust Lot Stock at Location" : "Adjust Stock at Location"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lotTracking
                ? "Select a lot and update the quantity for this location."
                : "Update the quantity for this item at the selected location."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            {/* Lot Selection (only shown if lot tracking is enabled) */}
            {lotTracking && lotsAtLocation.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Select Lot to Adjust</Label>
                <Select value={selectedLotForAdjustment} onValueChange={handleLotSelectionChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a lot" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotsAtLocation
                      .sort((a, b) => {
                        // Sort by expiration date (FIFO), but prioritize lots with quantity > 0
                        const aHasQty = a.locations.find(loc => loc.locationId === adjustmentDialog.locationId)?.quantity || 0;
                        const bHasQty = b.locations.find(loc => loc.locationId === adjustmentDialog.locationId)?.quantity || 0;

                        // Lots with quantity come first
                        if (aHasQty > 0 && bHasQty === 0) return -1;
                        if (aHasQty === 0 && bHasQty > 0) return 1;

                        // Then sort by expiration date (FIFO)
                        if (a.expirationDate && b.expirationDate) {
                          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
                        }
                        if (a.expirationDate) return -1
                        if (b.expirationDate) return 1
                        return new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()
                      })
                      .map((lot) => {
                        const lotLocation = lot.locations.find(
                          loc => loc.locationId === adjustmentDialog.locationId
                        )
                        const daysToExpiry = lot.expirationDate
                          ? Math.ceil((new Date(lot.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                          : null

                        return (
                          <SelectItem key={lot.id} value={lot.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold">{lot.lotNumber}</span>
                              <span className={lotLocation?.quantity === 0 ? "text-muted-foreground line-through" : "text-muted-foreground"}>
                                ({lotLocation?.quantity || 0} units)
                              </span>
                              {lotLocation?.quantity === 0 && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Depleted
                                </Badge>
                              )}
                              {daysToExpiry !== null && daysToExpiry <= 30 && lotLocation && lotLocation.quantity > 0 && (
                                <Badge variant="outline" className={
                                  daysToExpiry < 0 ? "text-red-600 border-red-600" :
                                    daysToExpiry <= 7 ? "text-orange-500 border-orange-500" :
                                      "text-yellow-600 border-yellow-600"
                                }>
                                  {daysToExpiry < 0 ? "Expired" : `${daysToExpiry}d`}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        )
                      })}
                  </SelectContent>
                </Select>
                {lotsAtLocation.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Lots sorted by expiration (FIFO) - adjust oldest first
                  </p>
                )}
              </div>
            )}

            {lotTracking && lotsAtLocation.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  No lots available at this location. Create a new lot to add stock.
                </AlertDescription>
              </Alert>
            )}

            {/* Current Quantity Display */}
            {(!lotTracking || selectedLotForAdjustment) && (
              <>
                <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border">
                  <span className="text-xs text-muted-foreground">Current Quantity</span>
                  <span className="text-base font-bold">{adjustmentDialog.currentQuantity}</span>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Adjustment Amount</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={decrementQuantity}
                      className="flex-shrink-0 h-9 w-9"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>

                    <Input
                      type="text"
                      value={adjustmentQuantity > 0 ? `+${adjustmentQuantity}` : adjustmentQuantity === 0 ? "0" : `${adjustmentQuantity}`}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "") {
                          setAdjustmentQuantity("")
                          setNewStockAmount(String(adjustmentDialog.currentQuantity))
                          return
                        }
                        if (val === "-" || val === "+") {
                          setAdjustmentQuantity(val)
                          return
                        }
                        const cleaned = val.replace(/[^0-9-+]/g, "")
                        const hasSign = cleaned.startsWith("-") || cleaned.startsWith("+")
                        const numbers = cleaned.replace(/[-+]/g, "")
                        const finalValue = hasSign ? cleaned.charAt(0) + numbers : numbers
                        if (finalValue === "-" || finalValue === "+") {
                          setAdjustmentQuantity(finalValue)
                        } else {
                          const num = Number.parseInt(finalValue)
                          if (!isNaN(num)) {
                            handleAdjustmentQuantityChange(String(num))
                          }
                        }
                      }}
                      className="text-center font-semibold flex-1 min-w-0 h-9 text-sm"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={incrementQuantity}
                      className="flex-shrink-0 h-9 w-9"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="newStock" className="text-xs">New Quantity</Label>
                  <Input
                    id="newStock"
                    type="number"
                    min="0"
                    value={newStockAmount}
                    onChange={(e) => handleNewStockAmountChange(e.target.value)}
                    className="font-semibold h-9 text-sm"
                  />
                  {Number.parseInt(newStockAmount) < 0 && (
                    <Alert variant="destructive" className="py-1.5">
                      <AlertCircle className="h-3 w-3" />
                      <AlertDescription className="text-xs">Stock quantity cannot be negative.</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="note" className="text-xs">Note (Optional)</Label>
                  <Textarea
                    id="note"
                    placeholder="Reason for adjustment..."
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                    className="min-h-14 resize-none text-xs"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAdjustmentDialog({ open: false, locationId: null, currentQuantity: 0, lotId: null })
                setAdjustmentQuantity("")
                setNewStockAmount("")
                setAdjustmentNote("")
                setSelectedLotForAdjustment("")
                setLotsAtLocation([])
              }}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStockAdjustment}
              disabled={
                !adjustmentQuantity ||
                adjustmentQuantity === "0" ||
                Number.parseInt(newStockAmount) < 0 ||
                (lotTracking && !selectedLotForAdjustment)
              }
              size="sm"
            >
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Customers Dialog */}
      <Dialog open={isManageCustomersOpen} onOpenChange={setIsManageCustomersOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              Manage Customers
            </DialogTitle>
            <DialogDescription className="text-xs">
              Link this item to specific customers. Multiple customers can be assigned to track custom orders or
              dedicated inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Assigned Customers ({selectedCustomerIds.length})</Label>
              {selectedCustomerIds.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                  No customers assigned yet
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/30"
                    >
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <span className="font-medium text-sm">{customer.name}</span>
                          {customer.company && (
                            <p className="text-xs text-muted-foreground">{customer.company}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemoveCustomer(customer.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addCustomer" className="text-xs font-medium">
                Add Customer
              </Label>
              <div className="flex gap-2">
                <Select value={newCustomerId} onValueChange={(value) => setNewCustomerId(value)}>
                  <SelectTrigger id="addCustomer" className="flex-1 h-8">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers
                      .filter((c) => !selectedCustomerIds.includes(c.id))
                      .map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div>
                            <div className="text-sm">{customer.name}</div>
                            {customer.company && (
                              <div className="text-xs text-muted-foreground">{customer.company}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddCustomer} disabled={!newCustomerId} size="sm" className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Select from existing customers or create new ones in the Customers page
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsManageCustomersOpen(false)}
              disabled={isSaving}
              size="sm"
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateCustomers} disabled={isSaving} size="sm">
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Locations Dialog */}
      <Dialog open={isManageLocationsOpen} onOpenChange={setIsManageLocationsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-accent" />
              </div>
              Manage Storage Locations
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign this item to one or more warehouse locations. This helps organize inventory and track where items are stored.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Assigned Locations ({selectedLocationIds.length})</Label>
              {selectedLocationIds.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                  No locations assigned yet
                </div>
              ) : (
                <div className="space-y-1.5">
                  {locations.filter(l => selectedLocationIds.includes(l.id)).map((location) => (
                    <div
                      key={location.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/30"
                    >
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <span className="font-medium font-mono text-sm">{location.code}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemoveLocation(location.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addLocation" className="text-xs font-medium">
                Add Location
              </Label>
              <div className="flex gap-2">
                <Select value={newLocationId} onValueChange={(value) => setNewLocationId(value)}>
                  <SelectTrigger id="addLocation" className="flex-1 h-8">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((l) => !selectedLocationIds.includes(l.id))
                      .map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          <div className="font-mono text-sm">{location.code}</div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddLocation} disabled={!newLocationId} size="sm" className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Select from existing locations or create new ones in the Locations page
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsManageLocationsOpen(false)}
              disabled={isSaving}
              size="sm"
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateLocations} disabled={isSaving} size="sm">
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Images Dialog */}
      <Dialog open={isManageImagesOpen} onOpenChange={setIsManageImagesOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <ImageIcon className="h-4 w-4 text-primary" />
              </div>
              Product Images
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload and manage photos. The primary image appears on the item card.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center mb-1.5">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mb-2 text-center">
                Drag and drop images or click to browse
              </p>
              <Button
                onClick={handleUploadImages}
                variant="outline"
                size="sm"
                className="gap-1.5 h-7"
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Select Images
                  </>
                )}
              </Button>
            </div>

            {images.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                  <ImageIcon className="h-5 w-5 opacity-30" />
                </div>
                <p className="text-xs font-medium">No images yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upload your first product image</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Gallery ({images.length})
                  </h3>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="relative group aspect-square rounded-lg overflow-hidden border-2 hover:border-primary/50 transition-all bg-muted cursor-pointer"
                      onClick={() => setSelectedImageUrl(`/api/items/images/image/${image.id}`)}
                    >
                      <img
                        src={`/api/items/images/image/${image.id}`}
                        alt="Product"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />

                      {image.isPrimary && (
                        <div className="absolute top-1.5 left-1.5">
                          <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white shadow-lg border-0 text-xs py-0 px-1">
                            <Star className="h-2 w-2 mr-0.5 fill-current" />
                            Primary
                          </Badge>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                          {!image.isPrimary ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 bg-white/90 hover:bg-white backdrop-blur-sm h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSetPrimaryImage(image.id)
                              }}
                            >
                              <Star className="h-2.5 w-2.5 mr-0.5" />
                              Set Primary
                            </Button>
                          ) : (
                            <div className="flex-1" />
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="shadow-lg h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteImage(image.id)
                            }}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {images.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Tip:</span> Click to preview • Hover to set primary or delete
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsManageImagesOpen(false)} className="w-full sm:w-auto" size="sm">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {selectedImageUrl && (
        <Dialog open={!!selectedImageUrl} onOpenChange={() => setSelectedImageUrl(null)}>
          <DialogContent className="max-w-4xl p-0">
            <div className="relative">
              <img
                src={selectedImageUrl}
                alt="Selected Product Image"
                className="w-full max-h-[80vh] object-contain"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setSelectedImageUrl(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Lot Dialog - Step 1: Lot Information */}
      <Dialog open={isCreateLotOpen} onOpenChange={setIsCreateLotOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <PackageCheck className="h-4 w-4 text-blue-600" />
              </div>
              Create New Lot (Step 1 of 2)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter lot information. You'll distribute quantities across locations in the next step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lotNumber" className="text-xs font-medium">
                  Lot Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lotNumber"
                  value={lotFormData.lotNumber}
                  onChange={(e) => setLotFormData({ ...lotFormData, lotNumber: e.target.value })}
                  placeholder="LOT-2024-001"
                  className="h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs font-medium">
                  Total Quantity <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={lotFormData.quantity}
                  onChange={(e) => setLotFormData({ ...lotFormData, quantity: e.target.value })}
                  placeholder="1000"
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="receivedDate" className="text-xs font-medium">
                  Received Date
                </Label>
                <Input
                  id="receivedDate"
                  type="date"
                  value={lotFormData.receivedDate}
                  onChange={(e) => setLotFormData({ ...lotFormData, receivedDate: e.target.value })}
                  className="h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manufactureDate" className="text-xs font-medium">
                  Manufacture Date
                </Label>
                <Input
                  id="manufactureDate"
                  type="date"
                  value={lotFormData.manufactureDate}
                  onChange={(e) => setLotFormData({ ...lotFormData, manufactureDate: e.target.value })}
                  className="h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expirationDate" className="text-xs font-medium">
                  Expiration Date
                </Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={lotFormData.expirationDate}
                  onChange={(e) => setLotFormData({ ...lotFormData, expirationDate: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lotSupplier" className="text-xs font-medium">
                  Supplier
                </Label>
                <Select value={lotFormData.supplierId} onValueChange={(value) => setLotFormData({ ...lotFormData, supplierId: value })}>
                  <SelectTrigger id="lotSupplier" className="h-8">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="poNumber" className="text-xs font-medium">
                  PO Number
                </Label>
                <Input
                  id="poNumber"
                  value={lotFormData.poNumber}
                  onChange={(e) => setLotFormData({ ...lotFormData, poNumber: e.target.value })}
                  placeholder="PO-12345"
                  className="h-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lotNotes" className="text-xs font-medium">
                Notes
              </Label>
              <Textarea
                id="lotNotes"
                value={lotFormData.notes}
                onChange={(e) => setLotFormData({ ...lotFormData, notes: e.target.value })}
                placeholder="Any additional information about this lot..."
                className="min-h-16 resize-none text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateLotOpen(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateLot} size="sm">
              Next: Distribute Stock →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribute Lot Dialog - Step 2: Location Distribution */}
      <Dialog open={isDistributeLotOpen} onOpenChange={setIsDistributeLotOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-blue-600" />
              </div>
              Distribute Stock (Step 2 of 2)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign quantities to storage locations. Total must equal {lotFormData.quantity} units.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            {/* Lot Summary */}
            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Lot Number</span>
                <span className="font-mono font-semibold text-sm">{lotFormData.lotNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Quantity</span>
                <span className="font-bold text-lg text-primary">{lotFormData.quantity} units</span>
              </div>
            </div>

            {/* Location Distribution */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Distribute Across Locations</Label>
              {locationAssignments.map((assignment) => {
                const location = locations.find(l => l.id === assignment.locationId)
                return (
                  <div key={assignment.locationId} className="flex items-center gap-2 p-2 bg-background rounded-lg border">
                    <span className="font-mono text-xs font-semibold min-w-[100px]">
                      {location?.code || assignment.locationId}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={assignment.quantity}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 0
                        setLocationAssignments(prev =>
                          prev.map(loc =>
                            loc.locationId === assignment.locationId
                              ? { ...loc, quantity: newQty }
                              : loc
                          )
                        )
                      }}
                      className="h-8 text-sm"
                      placeholder="0"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">units</span>
                  </div>
                )
              })}
            </div>

            {/* Quick Distribute Options */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const totalQty = parseInt(lotFormData.quantity) || 0
                  const numLocations = locationAssignments.length
                  const qtyPerLocation = Math.floor(totalQty / numLocations)
                  const remainder = totalQty % numLocations

                  setLocationAssignments(prev =>
                    prev.map((loc, index) => ({
                      ...loc,
                      quantity: index === 0 ? qtyPerLocation + remainder : qtyPerLocation
                    }))
                  )
                }}
                className="flex-1 text-xs"
              >
                Distribute Evenly
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const totalQty = parseInt(lotFormData.quantity) || 0
                  setLocationAssignments(prev =>
                    prev.map((loc, index) => ({
                      ...loc,
                      quantity: index === 0 ? totalQty : 0
                    }))
                  )
                }}
                className="flex-1 text-xs"
              >
                All to First Location
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocationAssignments(prev =>
                    prev.map(loc => ({ ...loc, quantity: 0 }))
                  )
                }}
                className="flex-1 text-xs"
              >
                Clear All
              </Button>
            </div>

            {/* Total Validation */}
            {(() => {
              const totalAssigned = locationAssignments.reduce((sum, loc) => sum + loc.quantity, 0)
              const totalRequired = parseInt(lotFormData.quantity) || 0
              const isValid = totalAssigned === totalRequired
              const difference = totalRequired - totalAssigned

              return (
                <div className={`text-xs p-3 rounded-lg font-medium border ${isValid
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-orange-50 text-orange-700 border-orange-200'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span>{isValid ? '✓ Perfect!' : '⚠️ Adjust quantities'}</span>
                    <span className="font-bold">
                      {totalAssigned} / {totalRequired} units
                      {!isValid && difference !== 0 && (
                        <span className="ml-2 text-xs">
                          ({difference > 0 ? `${difference} remaining` : `${Math.abs(difference)} over`})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                // Go back to step 1
                setIsDistributeLotOpen(false)
                setIsCreateLotOpen(true)
              }}
              size="sm"
              disabled={isSaving}
            >
              ← Back
            </Button>
            <Button
              onClick={handleDistributeLot}
              disabled={
                isSaving ||
                locationAssignments.reduce((sum, loc) => sum + loc.quantity, 0) !== parseInt(lotFormData.quantity)
              }
              size="sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
                  Create Lot
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}