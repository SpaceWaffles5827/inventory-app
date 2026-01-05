"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LayoutGrid, List, TableIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  Plus,
  Search,
  AlertCircle,
  Trash2,
  DollarSign,
  Loader2,
  X,
  SlidersHorizontal,
  Diff,
  MapPin,
} from "lucide-react"
import { getCategoriesApi } from "@/lib/api/categories.api"
import { getLocationsApi } from "@/lib/api/locations.api"
import { createItemApi, getItemsApi, adjustStockApi, deleteItemApi, type ItemWithRelations } from "@/lib/api/items.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { CategoryWithCount } from "@/lib/api/categories.api"
import { LocationWithCount } from "@/lib/api/locations.api"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function DashboardPage() {
  const router = useRouter()
  const [inventory, setInventory] = useState<ItemWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inventoryViewMode")
      return (saved as "table" | "grid" | "list") || "table"
    }
    return "table"
  })
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    item: ItemWithRelations | null
  }>({
    open: false,
    item: null,
  })
  const [isDeleting, setIsDeleting] = useState(false)
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    barcode: "",
    unit: "",
    category: "",
    description: "",
    supplier: "",
    onHand: "",
    storageLocation: "",
    cost: "",
  })
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    open: boolean
    item: ItemWithRelations | null
  }>({
    open: false,
    item: null,
  })
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
  const [newStockAmount, setNewStockAmount] = useState("")
  const [adjustmentReason, setAdjustmentReason] = useState("")
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [adjustmentNote, setAdjustmentNote] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  // Add state for categories, locations, and suppliers
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem("inventoryViewMode", viewMode)
  }, [viewMode])

  // Load workspace ID and items on mount
  useEffect(() => {
    const workspaceId = localStorage.getItem("currentWorkspaceId")
    if (workspaceId) {
      setCurrentWorkspaceId(workspaceId)
      loadItems(workspaceId)
      loadCategories(workspaceId)
      loadLocations(workspaceId)
      loadSuppliers(workspaceId)
    } else {
      setLoading(false)
    }
  }, [])

  // Add a second useEffect to reload items when workspace changes
  useEffect(() => {
    const handleStorageChange = () => {
      const workspaceId = localStorage.getItem("currentWorkspaceId")
      if (workspaceId && workspaceId !== currentWorkspaceId) {
        setCurrentWorkspaceId(workspaceId)
        loadItems(workspaceId)
        loadCategories(workspaceId)
        loadLocations(workspaceId)
        loadSuppliers(workspaceId)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [currentWorkspaceId])

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

  const loadItems = async (workspaceId: string) => {
    try {
      setLoading(true)
      const response = await getItemsApi(workspaceId)

      if (response.data?.items) {
        setInventory(response.data.items)
      }
    } catch (err) {
      console.error("Failed to load items:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!deleteDialog.item) return

    setIsDeleting(true)
    try {
      await deleteItemApi(deleteDialog.item.id)

      // Remove item from local state
      setInventory((prev) => prev.filter((item) => item.id !== deleteDialog.item?.id))

      setDeleteDialog({ open: false, item: null })
      toast.success("Item deleted successfully")
    } catch (error) {
      console.error("Failed to delete item:", error)
      alert(error instanceof Error ? error.message : "Failed to delete item")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateItem = async () => {
    if (
      !newItemForm.name.trim() ||
      !newItemForm.category.trim() ||
      !newItemForm.supplier.trim() ||
      !newItemForm.onHand ||
      !newItemForm.cost
    ) {
      return
    }

    if (!currentWorkspaceId) {
      setCreateError("No workspace selected. Please select a workspace first.")
      return
    }

    setIsCreating(true)
    setCreateError("")

    try {
      const onHand = Number.parseInt(newItemForm.onHand)
      const cost = Number.parseFloat(newItemForm.cost)

      const response = await createItemApi({
        workspaceId: currentWorkspaceId,
        name: newItemForm.name,
        barcode: newItemForm.barcode || undefined,
        unit: newItemForm.unit || undefined,
        description: newItemForm.description || undefined,
        onHand: onHand,
        cost: cost,
        categoryId: newItemForm.category,
        locationId: newItemForm.storageLocation || undefined,
        supplierId: newItemForm.supplier,
      })

      if (response.data?.item) {
        setInventory([...inventory, response.data.item])
      }

      setNewItemForm({
        name: "",
        barcode: "",
        unit: "",
        category: "",
        description: "",
        supplier: "",
        onHand: "",
        storageLocation: "",
        cost: "",
      })
      setIsAddItemOpen(false)
    } catch (err) {
      console.error("Create item error:", err)
      setCreateError(err instanceof Error ? err.message : "Failed to create item")
    } finally {
      setIsCreating(false)
    }
  }

  const openAdjustmentDialog = (item: ItemWithRelations) => {
    setAdjustmentDialog({ open: true, item })
    setAdjustmentQuantity("")
    setNewStockAmount(String(item.onHand))
    setAdjustmentReason("")
    setAdjustmentNote("")

    // Auto-select location if item only has one location
    if (item.locations && item.locations.length === 1) {
      setSelectedLocationId(item.locations[0].locationId)
    } else {
      setSelectedLocationId("")
    }
  }

  // Get current stock for selected location
  const getCurrentLocationStock = () => {
    if (!adjustmentDialog.item || !selectedLocationId) return 0

    // Find the selected location in the item's locations
    const itemLocation = adjustmentDialog.item.locations?.find(
      loc => loc.locationId === selectedLocationId
    )

    return itemLocation?.quantity || 0
  }

  // Handle adjustment quantity changes and update new stock amount
  const handleAdjustmentQuantityChange = (value: string) => {
    setAdjustmentQuantity(value)
    if (value && value !== "-" && value !== "+") {
      const qty = Number.parseInt(value)
      if (!isNaN(qty)) {
        const currentStock = getCurrentLocationStock()
        setNewStockAmount(String(currentStock + qty))
      }
    }
  }

  // Handle new stock amount changes and calculate adjustment quantity
  const handleNewStockAmountChange = (value: string) => {
    setNewStockAmount(value)
    if (value) {
      const newStock = Number.parseInt(value)
      if (!isNaN(newStock)) {
        const currentStock = getCurrentLocationStock()
        const adjustment = newStock - currentStock
        setAdjustmentQuantity(String(adjustment))
      }
    } else {
      setAdjustmentQuantity("")
    }
  }

  const handleStockAdjustment = async () => {
    if (
      !adjustmentDialog.item ||
      !adjustmentQuantity ||
      adjustmentQuantity === "0" ||
      !selectedLocationId
    ) {
      return
    }

    const quantity = Number.parseInt(adjustmentQuantity)
    const itemId = adjustmentDialog.item.id
    const isInput = quantity > 0

    try {
      const response = await adjustStockApi(itemId, {
        type: isInput ? "INPUT" : "OUTPUT",
        quantity: Math.abs(quantity),
        reason: adjustmentNote || "Stock adjustment",
        locationId: selectedLocationId,
      })

      if (response.data?.item) {
        const updatedItem = response.data.item

        setInventory((prev) =>
          prev.map((item) => (item.id === itemId ? updatedItem : item))
        )
      }

      setAdjustmentDialog({ open: false, item: null })
      setAdjustmentQuantity("")
      setNewStockAmount("")
      setAdjustmentReason("")
      setSelectedLocationId("")
      setAdjustmentNote("")
    } catch (error) {
      console.error("Failed to adjust stock:", error)
      alert(error instanceof Error ? error.message : "Failed to adjust stock")
    }
  }

  const filteredInventory = inventory
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.barcode || "").includes(searchQuery) ||
        (item.category?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.supplier?.name || "").toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = categoryFilter === "all" || item.category?.name === categoryFilter
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const matchesSupplier = supplierFilter === "all" || item.supplier?.name === supplierFilter

      return matchesSearch && matchesCategory && matchesStatus && matchesSupplier
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "itemNumber":
          return a.itemNumber.localeCompare(b.itemNumber)
        case "onHand-asc":
          return a.onHand - b.onHand
        case "onHand-desc":
          return b.onHand - a.onHand
        case "cost-asc":
          return a.cost - b.cost
        case "cost-desc":
          return b.cost - a.cost
        default:
          return 0
      }
    })

  const inventoryCategories = Array.from(
    new Set(
      inventory
        .map((item) => item.category?.name)
        .filter((name): name is string => name !== null && name !== undefined)
    )
  )

  const inventorySuppliers = Array.from(
    new Set(
      inventory
        .map((item) => item.supplier?.name)
        .filter((name): name is string => name !== null && name !== undefined)
    )
  )
  const statuses = Array.from(new Set(inventory.map((item) => item.status)))

  const hasActiveFilters = categoryFilter !== "all" || statusFilter !== "all" || supplierFilter !== "all"

  const clearFilters = () => {
    setCategoryFilter("all")
    setStatusFilter("all")
    setSupplierFilter("all")
    setSearchQuery("")
  }

  const totalItems = inventory.reduce((sum, item) => sum + item.onHand, 0)
  const lowStockItems = inventory.filter((item) => item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK").length
  const totalValue = inventory.reduce((sum, item) => sum + item.onHand * item.cost, 0)

  const incrementQuantity = () => {
    const current = Number.parseInt(adjustmentQuantity || "0")
    handleAdjustmentQuantityChange(String(current + 1))
  }

  const decrementQuantity = () => {
    const current = Number.parseInt(adjustmentQuantity || "0")
    handleAdjustmentQuantityChange(String(current - 1))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">Across {inventory.length} products</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{lowStockItems}</div>
              <p className="text-xs text-muted-foreground mt-1">Items need restocking</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">
                ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Current inventory value</p>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Table */}
        <Card className="border-border/50 gap-0">
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">Inventory</CardTitle>
                  <CardDescription>Manage your products and stock levels</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={viewMode} onValueChange={(value: "table" | "grid" | "list") => setViewMode(value)}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">
                        <div className="flex items-center">
                          <TableIcon className="h-4 w-4 mr-2" />
                          Table View
                        </div>
                      </SelectItem>
                      <SelectItem value="grid">
                        <div className="flex items-center">
                          <LayoutGrid className="h-4 w-4 mr-2" />
                          Grid View
                        </div>
                      </SelectItem>
                      <SelectItem value="list">
                        <div className="flex items-center">
                          <List className="h-4 w-4 mr-2" />
                          List View
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
                    <DialogTrigger asChild>
                      <Button className="shadow-lg shadow-accent/20">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Item</DialogTitle>
                        <DialogDescription>
                          Add a new item to your inventory with all required details.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-name">
                              Item Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="item-name"
                              placeholder="e.g., Wireless Mouse"
                              value={newItemForm.name}
                              onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-unit">
                              Unit
                            </Label>
                            <Input
                              id="item-unit"
                              placeholder="e.g., EA, BOX, LB, KG, GAL"
                              value={newItemForm.unit}
                              onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-category">
                              Category <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={newItemForm.category}
                              onValueChange={(value) => setNewItemForm({ ...newItemForm, category: value })}
                            >
                              <SelectTrigger id="item-category">
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
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-supplier">
                              Supplier <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={newItemForm.supplier}
                              onValueChange={(value) => setNewItemForm({ ...newItemForm, supplier: value })}
                            >
                              <SelectTrigger id="item-supplier">
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
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="item-description">Description</Label>
                          <Textarea
                            id="item-description"
                            placeholder="Brief description of the item..."
                            value={newItemForm.description}
                            onChange={(e) => setNewItemForm({ ...newItemForm, description: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-onhand">
                              Initial Stock <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="item-onhand"
                              type="number"
                              min="0"
                              placeholder="0"
                              value={newItemForm.onHand}
                              onChange={(e) => setNewItemForm({ ...newItemForm, onHand: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-cost">
                              Unit Cost <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="item-cost"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={newItemForm.cost}
                              onChange={(e) => setNewItemForm({ ...newItemForm, cost: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-location">Storage Location</Label>
                            <Select
                              value={newItemForm.storageLocation}
                              onValueChange={(value) => setNewItemForm({ ...newItemForm, storageLocation: value })}
                            >
                              <SelectTrigger id="item-location">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {createError && <p className="text-sm text-destructive">{createError}</p>}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateItem}
                          disabled={
                            isCreating ||
                            !newItemForm.name.trim() ||
                            !newItemForm.category.trim() ||
                            !newItemForm.supplier.trim() ||
                            !newItemForm.onHand ||
                            !newItemForm.cost
                          }
                        >
                          {isCreating ? "Creating..." : "Add Item"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, item #, barcode, category, or supplier..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowFilters(!showFilters)}
                    className={showFilters ? "bg-accent/10 border-accent/20" : ""}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                      <X className="h-4 w-4" />
                      Clear
                    </Button>
                  )}
                </div>

                {showFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {inventoryCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status === "IN_STOCK" ? "In Stock" : status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Supplier</Label>
                      <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Suppliers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Suppliers</SelectItem>
                          {inventorySuppliers.map((supplier) => (
                            <SelectItem key={supplier} value={supplier}>
                              {supplier}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Sort By</Label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Name (A-Z)</SelectItem>
                          <SelectItem value="itemNumber">Item Number</SelectItem>
                          <SelectItem value="onHand-asc">Stock (Low to High)</SelectItem>
                          <SelectItem value="onHand-desc">Stock (High to Low)</SelectItem>
                          <SelectItem value="cost-asc">Cost (Low to High)</SelectItem>
                          <SelectItem value="cost-desc">Cost (High to Low)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {hasActiveFilters && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {categoryFilter !== "all" && (
                      <Badge variant="secondary" className="gap-1">
                        Category: {categoryFilter}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => setCategoryFilter("all")}
                        />
                      </Badge>
                    )}
                    {statusFilter !== "all" && (
                      <Badge variant="secondary" className="gap-1">
                        Status: {statusFilter === "IN_STOCK" ? "In Stock" : statusFilter === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => setStatusFilter("all")}
                        />
                      </Badge>
                    )}
                    {supplierFilter !== "all" && (
                      <Badge variant="secondary" className="gap-1">
                        Supplier: {supplierFilter}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => setSupplierFilter("all")}
                        />
                      </Badge>
                    )}
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Showing {filteredInventory.length} of {inventory.length} items
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className={viewMode === "table" ? "" : ""}>
            {viewMode === "table" && (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[60px]"></TableHead>
                      <TableHead className="font-semibold">Item #</TableHead>
                      <TableHead className="font-semibold">Product Name</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Supplier</TableHead>
                      <TableHead className="font-semibold">Locations</TableHead>
                      <TableHead className="text-center font-semibold">Stock</TableHead>
                      <TableHead className="text-right font-semibold">Cost</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          No items found matching your filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInventory.map((item) => (
                        <TableRow
                          key={item.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => router.push(`/dashboard/items/${item.id}`)}
                        >
                          <TableCell>
                            <div className="w-12 h-12 rounded-md bg-muted/50 border border-border flex items-center justify-center overflow-hidden">
                              <img
                                src="https://images.unsplash.com/photo-1545127398-14699f92334b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aXRlbXN8ZW58MHx8MHx8fDA%3D"
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{item.itemNumber}</TableCell>
                          <TableCell className="max-w-0 w-full">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground font-mono truncate">{item.barcode || "—"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {item.category?.name || "Uncategorized"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.supplier?.name || "Unknown"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[150px]">
                            {item.locations && item.locations.filter(loc => loc.quantity > 0).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.locations
                                  .filter(loc => loc.quantity > 0)
                                  .map((loc, idx, arr) => (
                                    <span key={loc.id} className="text-xs">
                                      {loc.location.code} ({loc.quantity}){idx < arr.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              "Unassigned"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <span className="font-semibold text-lg min-w-12 text-center">{item.onHand}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">${item.cost.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                              className={
                                item.status === "IN_STOCK"
                                  ? "bg-accent/10 text-accent hover:bg-accent/20"
                                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                              }
                            >
                              {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="icon"
                                className="flex-1 h-9 hover:bg-accent/10 hover:text-accent bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openAdjustmentDialog(item)
                                }}
                              >
                                <Diff className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="flex-1 h-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteDialog({ open: true, item })
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {viewMode === "grid" && (
              <>
                {filteredInventory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No items found matching your filters</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {filteredInventory.map((item) => (
                      <Card
                        key={item.id}
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-accent/50 flex flex-col pt-0 overflow-hidden"
                        onClick={() => router.push(`/dashboard/items/${item.id}`)}
                      >
                        <div className="relative w-full h-48 bg-muted/30 border-b border-border overflow-hidden">
                          <img
                            src="https://images.unsplash.com/photo-1545127398-14699f92334b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aXRlbXN8ZW58MHx8MHx8fDA%3D"
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardHeader className="pb-3 flex-none pt-0">
                          <div className="space-y-2">
                            <div className="min-w-0 overflow-hidden h-[52px]">
                              <CardTitle
                                className="text-base font-semibold line-clamp-2 break-words"
                                title={item.name}
                              >
                                {item.name}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{item.itemNumber}</p>
                            </div>
                            <Badge
                              variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                              className={
                                item.status === "IN_STOCK"
                                  ? "bg-accent/10 text-accent w-fit"
                                  : "bg-destructive/10 text-destructive w-fit"
                              }
                            >
                              {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-0">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Stock</p>
                                <p className="text-2xl font-bold">{item.onHand}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Cost</p>
                                <p className="text-lg font-semibold">${item.cost.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 hover:bg-accent/10 hover:text-accent bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation()
                                openAdjustmentDialog(item)
                              }}
                            >
                              <Diff className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteDialog({ open: true, item })
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {viewMode === "list" && (
              <>
                {filteredInventory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No items found matching your filters</div>
                ) : (
                  <div className="space-y-3">
                    {filteredInventory.map((item) => (
                      <Card
                        key={item.id}
                        className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-accent/50 overflow-hidden"
                        onClick={() => router.push(`/dashboard/items/${item.id}`)}
                      >
                        <CardContent className="pt-0 pb-0">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-20 h-20 rounded-md bg-muted/50 border border-border overflow-hidden flex-shrink-0">
                              <img
                                src="https://images.unsplash.com/photo-1545127398-14699f92334b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aXRlbXN8ZW58MHx8MHx8fDA%3D"
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-start gap-3 mb-1 min-w-0">
                                <h3 className="font-semibold text-base line-clamp-2 break-words flex-1 min-w-0 overflow-hidden" title={item.name}>
                                  {item.name}
                                </h3>
                                <Badge
                                  variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                                  className={
                                    item.status === "IN_STOCK"
                                      ? "bg-accent/10 text-accent flex-shrink-0"
                                      : "bg-destructive/10 text-destructive flex-shrink-0"
                                  }
                                >
                                  {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap min-w-0">
                                <span className="font-mono">{item.itemNumber}</span>
                                {/* <span>•</span> */}
                                <span className="text-xs truncate min-w-0">
                                  {item.locations && item.locations.filter(loc => loc.quantity > 0).length > 0
                                    ? item.locations
                                      .filter(loc => loc.quantity > 0)
                                      .map(loc => `${loc.location.code} (${loc.quantity})`)
                                      .join(', ')
                                    : "Unassigned"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 flex-none">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Stock</p>
                                <p className="text-2xl font-semibold">{item.onHand}</p>
                              </div>
                              <div className="text-center min-w-[70px]">
                                <p className="text-xs text-muted-foreground mb-1">Cost</p>
                                <p className="text-base font-medium">${item.cost.toFixed(2)}</p>
                              </div>
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 hover:bg-accent/10 hover:text-accent bg-transparent"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openAdjustmentDialog(item)
                                  }}
                                >
                                  <Diff className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteDialog({ open: true, item })
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={adjustmentDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustmentDialog({ open: false, item: null })
            setAdjustmentQuantity("")
            setNewStockAmount("")
            setAdjustmentReason("")
            setSelectedLocationId("")
            setAdjustmentNote("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[540px] gap-0 p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <DialogHeader>
              <DialogTitle className="text-lg">Update Quantity</DialogTitle>
              <DialogDescription className="text-xs">
                Adjust the stock quantity for this item at a specific location.
              </DialogDescription>
            </DialogHeader>
          </div>

          {adjustmentDialog.item && (
            <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Item Info - Compact */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{adjustmentDialog.item.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {adjustmentDialog.item.onHand} units | ${(adjustmentDialog.item.cost * adjustmentDialog.item.onHand).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Location Selection - Compact */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Select Location
                </Label>
                <RadioGroup value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <div className="space-y-1.5">
                    {adjustmentDialog.item.locations && adjustmentDialog.item.locations.length > 0 ? (
                      adjustmentDialog.item.locations.map((itemLocation) => (
                        <div
                          key={itemLocation.id}
                          className={`flex items-center space-x-2 p-2 rounded-lg border transition-colors ${selectedLocationId === itemLocation.locationId
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                            }`}
                        >
                          <RadioGroupItem
                            value={itemLocation.locationId}
                            id={`location-${itemLocation.locationId}`}
                            className="flex-shrink-0"
                          />
                          <Label
                            htmlFor={`location-${itemLocation.locationId}`}
                            className="flex-1 cursor-pointer min-w-0"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-mono font-semibold text-xs truncate">{itemLocation.location.code}</p>
                                {itemLocation.location.name && (
                                  <p className="text-[10px] text-muted-foreground truncate">{itemLocation.location.name}</p>
                                )}
                              </div>
                              <p className="font-semibold text-sm flex-shrink-0 whitespace-nowrap">{itemLocation.quantity} units</p>
                            </div>
                          </Label>
                        </div>
                      ))
                    ) : (
                      <Alert className="py-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <AlertDescription className="text-xs">No locations assigned to this item.</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </RadioGroup>
              </div>

              {!selectedLocationId && adjustmentDialog.item.locations && adjustmentDialog.item.locations.length > 0 && (
                <Alert className="py-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">Please select a location to update stock quantity.</AlertDescription>
                </Alert>
              )}

              {selectedLocationId && (
                <>
                  {/* Adjustment Controls */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Adjustment Quantity</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={decrementQuantity}
                        className="flex-shrink-0"
                      >
                        <span className="text-lg">−</span>
                      </Button>

                      <Input
                        type="text"
                        value={adjustmentQuantity > 0 ? `+${adjustmentQuantity}` : adjustmentQuantity === 0 ? "0" : `${adjustmentQuantity}`}
                        onChange={(e) => {
                          const val = e.target.value

                          if (val === "") {
                            setAdjustmentQuantity("")
                            setNewStockAmount(String(getCurrentLocationStock()))
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
                        className="text-center font-semibold flex-1 min-w-0"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={incrementQuantity}
                        className="flex-shrink-0"
                      >
                        <span className="text-lg">+</span>
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Current stock at this location: {getCurrentLocationStock()} units
                    </p>
                  </div>

                  {/* New Quantity Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="newStock" className="text-xs">New Quantity at Location</Label>
                    <Input
                      id="newStock"
                      type="number"
                      min="0"
                      value={newStockAmount}
                      onChange={(e) => handleNewStockAmountChange(e.target.value)}
                      className="font-semibold"
                    />
                    {Number.parseInt(newStockAmount) < 0 && (
                      <Alert variant="destructive" className="py-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <AlertDescription className="text-xs">Stock quantity cannot be negative.</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </>
              )}

              {/* Transaction Note */}
              <div className="space-y-1.5">
                <Label htmlFor="note" className="text-xs">Transaction Note (Optional)</Label>
                <Textarea
                  id="note"
                  placeholder="Add any additional notes..."
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  className="min-h-16 resize-none text-sm"
                />
              </div>
            </div>
          )}

          <div className="px-6 pb-6 pt-4 border-t">
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAdjustmentDialog({ open: false, item: null })
                  setAdjustmentQuantity("")
                  setNewStockAmount("")
                  setAdjustmentReason("")
                  setSelectedLocationId("")
                  setAdjustmentNote("")
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
                  !selectedLocationId ||
                  Number.parseInt(newStockAmount) < 0
                }
                size="sm"
              >
                Update Stock
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({ open: false, item: null })
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Item
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteDialog.item && (
            <div className="py-4">
              <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <p className="font-semibold text-sm">{deleteDialog.item.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Item #: {deleteDialog.item.itemNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  Current Stock: {deleteDialog.item.onHand} units
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, item: null })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteItem}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}