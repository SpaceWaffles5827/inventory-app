"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  X,
  SlidersHorizontal,
} from "lucide-react"
import { getCategoriesApi } from "@/lib/api/categories.api"
import { getLocationsApi } from "@/lib/api/locations.api"
import { createItemApi, getItemsApi, adjustStockApi, type ItemWithRelations } from "@/lib/api/items.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { CategoryWithCount } from "@/lib/api/categories.api"
import { LocationWithCount } from "@/lib/api/locations.api"

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
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    barcode: "",
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
    type: "input" | "output" | null
  }>({
    open: false,
    item: null,
    type: null,
  })
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
  const [adjustmentReason, setAdjustmentReason] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  // Add state for categories, locations, and suppliers
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])

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

  const handleCreateItem = async () => {
    if (
      !newItemForm.name.trim() ||
      !newItemForm.barcode.trim() ||
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
      const nextItemNumber = `ITM-${String(inventory.length + 1).padStart(3, "0")}`

      const response = await createItemApi({
        workspaceId: currentWorkspaceId,
        itemNumber: nextItemNumber,
        name: newItemForm.name,
        barcode: newItemForm.barcode,
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

  const openAdjustmentDialog = (item: ItemWithRelations, type: "input" | "output") => {
    setAdjustmentDialog({ open: true, item, type })
    setAdjustmentQuantity("")
    setAdjustmentReason("")
  }

  const handleStockAdjustment = async () => {
    if (
      !adjustmentDialog.item ||
      !adjustmentQuantity ||
      Number.parseInt(adjustmentQuantity) <= 0 ||
      !adjustmentReason.trim()
    ) {
      return
    }

    const quantity = Number.parseInt(adjustmentQuantity)
    const itemId = adjustmentDialog.item.id

    try {
      const response = await adjustStockApi(itemId, {
        type: adjustmentDialog.type === "input" ? "INPUT" : "OUTPUT",
        quantity: quantity,
        reason: adjustmentReason,
      })

      if (response.data?.item) {
        // Store the updated item in a variable to avoid "possibly undefined" error
        const updatedItem = response.data.item

        // Update the local state with the new item data from the API
        setInventory((prev) =>
          prev.map((item) => (item.id === itemId ? updatedItem : item))
        )
      }

      setAdjustmentDialog({ open: false, item: null, type: null })
      setAdjustmentQuantity("")
      setAdjustmentReason("")
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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
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
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">Inventory</CardTitle>
                  <CardDescription>Manage your products and stock levels</CardDescription>
                </div>
                <div className="flex items-center gap-3">
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
                            <Label htmlFor="item-barcode">
                              Barcode <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="item-barcode"
                              placeholder="e.g., 123456789012"
                              value={newItemForm.barcode}
                              onChange={(e) => setNewItemForm({ ...newItemForm, barcode: e.target.value })}
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
                            !newItemForm.barcode.trim() ||
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
          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Item #</TableHead>
                    <TableHead className="font-semibold">Product Name</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold">Supplier</TableHead>
                    <TableHead className="font-semibold">Location</TableHead>
                    <TableHead className="text-center font-semibold">Stock</TableHead>
                    <TableHead className="text-right font-semibold">Cost</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-center font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
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
                        <TableCell className="font-mono text-sm text-muted-foreground">{item.itemNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{item.barcode || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {item.category?.name || "Uncategorized"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.supplier?.name || "Unknown"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                          {item.location?.code || "Unassigned"}
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
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation()
                                openAdjustmentDialog(item, "output")
                              }}
                            >
                              <ArrowDownCircle className="h-3.5 w-3.5 mr-1" />
                              Out
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 hover:bg-accent/10 hover:text-accent hover:border-accent/30 bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation()
                                openAdjustmentDialog(item, "input")
                              }}
                            >
                              <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                              In
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={adjustmentDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustmentDialog({ open: false, item: null, type: null })
            setAdjustmentQuantity("")
            setAdjustmentReason("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {adjustmentDialog.type === "input" ? (
                <>
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <ArrowUpCircle className="h-5 w-5 text-accent" />
                  </div>
                  Stock Input Transaction
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <ArrowDownCircle className="h-5 w-5 text-destructive" />
                  </div>
                  Stock Output Transaction
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-base">
              {adjustmentDialog.type === "input"
                ? "Record incoming inventory for warehouse tracking and audit purposes"
                : "Record outgoing inventory for warehouse tracking and audit purposes"}
            </DialogDescription>
          </DialogHeader>

          {adjustmentDialog.item && (
            <div className="space-y-6 py-4">
              <div className="rounded-lg border-2 border-border/50 bg-muted/30 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-semibold text-lg">{adjustmentDialog.item.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{adjustmentDialog.item.itemNumber}</p>
                    <p className="text-xs text-muted-foreground">Barcode: {adjustmentDialog.item.barcode || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Current Stock</p>
                    <p className="text-3xl font-bold">{adjustmentDialog.item.onHand}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <p className="font-medium">{adjustmentDialog.item.location?.code || "Unassigned"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p className="font-medium">{adjustmentDialog.item.category?.name || "Uncategorized"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-sm font-semibold">
                    Quantity <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    placeholder="Enter quantity to adjust"
                    value={adjustmentQuantity}
                    onChange={(e) => setAdjustmentQuantity(e.target.value)}
                    className="text-lg h-12"
                  />
                  {adjustmentQuantity && Number.parseInt(adjustmentQuantity) <= 0 && (
                    <p className="text-xs text-destructive">Quantity must be greater than 0</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-sm font-semibold">
                    Transaction Reason / Notes <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder={
                      adjustmentDialog.type === "input"
                        ? "Required: Specify reason (e.g., 'Received shipment #12345 from supplier', 'Customer return - Order #6789', 'Stock correction after audit')"
                        : "Required: Specify reason (e.g., 'Fulfilled order #12345', 'Damaged during inspection', 'Transfer to Location B-02', 'Sample for quality testing')"
                    }
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    This information is required for audit trail and inventory tracking
                  </p>
                </div>

                {adjustmentQuantity && Number.parseInt(adjustmentQuantity) > 0 && (
                  <div className="rounded-lg border-2 border-border/50 bg-linear-to-br from-muted/50 to-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">New Stock Level</p>
                        <p className="text-3xl font-bold">
                          {adjustmentDialog.type === "input"
                            ? adjustmentDialog.item.onHand + Number.parseInt(adjustmentQuantity)
                            : Math.max(0, adjustmentDialog.item.onHand - Number.parseInt(adjustmentQuantity))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Change</p>
                        <p
                          className={`text-2xl font-bold ${adjustmentDialog.type === "input" ? "text-accent" : "text-destructive"
                            }`}
                        >
                          {adjustmentDialog.type === "input" ? "+" : "-"}
                          {adjustmentQuantity}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAdjustmentDialog({ open: false, item: null, type: null })
                setAdjustmentQuantity("")
                setAdjustmentReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStockAdjustment}
              disabled={!adjustmentQuantity || Number.parseInt(adjustmentQuantity) <= 0 || !adjustmentReason.trim()}
              className={
                adjustmentDialog.type === "input"
                  ? "bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20"
                  : "bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20"
              }
            >
              Confirm {adjustmentDialog.type === "input" ? "Input" : "Output"} Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}