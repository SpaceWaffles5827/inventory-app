"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TransferStockWizard } from "@/components/transferStockWizard"
import { DeleteItemDialog } from "@/components/deleteItemDialog"
import { AddItemDialog } from "@/components/addItemDialog"
import { LayoutGrid, List, TableIcon, ImageIcon } from "lucide-react"
import { StockAdjustmentWizard } from "@/components/stockAdjustmentWizard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  ArrowRightLeft,
} from "lucide-react"
import { getCategoriesApi } from "@/lib/api/categories.api"
import { getLocationsApi } from "@/lib/api/locations.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { CategoryWithCount } from "@/lib/api/categories.api"
import { LocationWithCount } from "@/lib/api/locations.api"

// Helper component for item images
const ItemImage = ({ itemId, alt, className }: { itemId: string; alt: string; className?: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadPrimaryImage = async () => {
      try {
        setLoading(true)
        setError(false)

        // Fetch images for this item
        const response = await fetch(`/api/items/images/${itemId}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          setError(true)
          return
        }

        const data = await response.json()

        // Find primary image
        const primaryImage = data.data?.images?.find((img: any) => img.isPrimary)

        if (primaryImage) {
          setImageUrl(`/api/items/images/image/${primaryImage.id}`)
        } else {
          setError(true)
        }
      } catch (err) {
        console.error('Failed to load image:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadPrimaryImage()
  }, [itemId])

  if (loading) {
    return (
      <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !imageUrl) {
    return (
      <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  )
}

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteDialogItem, setDeleteDialogItem] = useState<ItemWithRelations | null>(null)

  // Add state for categories, locations, and suppliers
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])

  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferDialogItem, setTransferDialogItem] = useState<ItemWithRelations | null>(null)

  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
  const [adjustmentDialogItem, setAdjustmentDialogItem] = useState<ItemWithRelations | null>(null)

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

  const openTransferDialog = (item: ItemWithRelations) => {
    setTransferDialogItem(item)
    setTransferDialogOpen(true)
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

  const openDeleteDialog = (item: ItemWithRelations) => {
    setDeleteDialogItem(item)
    setDeleteDialogOpen(true)
  }

  const openAdjustmentDialog = (item: ItemWithRelations) => {
    setAdjustmentDialogItem(item)
    setAdjustmentDialogOpen(true)
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

                  <Button
                    className="shadow-lg shadow-accent/20 text-white"
                    onClick={() => setIsAddItemOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>

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
                      {/* <TableHead className="font-semibold">Category</TableHead> */}
                      {/* <TableHead className="font-semibold">Supplier</TableHead> */}
                      {/* <TableHead className="font-semibold">Locations</TableHead> */}
                      <TableHead className="text-center font-semibold">Stock</TableHead>
                      <TableHead className="text-right font-semibold">Cost</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
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
                              <ItemImage
                                itemId={item.id}
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
                          {/* <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {item.category?.name || "Uncategorized"}
                            </Badge>
                          </TableCell> */}
                          {/* <TableCell className="text-muted-foreground text-sm">{item.supplier?.name || "Unknown"}</TableCell> */}
                          {/* <TableCell className="text-muted-foreground text-sm max-w-[150px]">
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
                          </TableCell> */}
                          <TableCell>
                            <div className="flex items-baseline justify-end gap-1.5 pr-4">
                              <span className="font-semibold text-lg tabular-nums text-right min-w-[3ch]">{item.onHand}</span>
                              <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-tight w-[3.5ch] text-left">{item.unit || "EA"}</span>
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
                              {/* ADD THIS TRANSFER BUTTON */}
                              <Button
                                variant="outline"
                                size="icon"
                                className="flex-1 h-9 hover:bg-blue-500/10 hover:text-blue-600 bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openTransferDialog(item)
                                }}
                                title="Transfer stock between locations"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="flex-1 h-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openDeleteDialog(item)
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
                          <ItemImage
                            itemId={item.id}
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
                                <div className="flex items-baseline gap-1.5">
                                  <p className="text-2xl font-bold tabular-nums">{item.onHand}</p>
                                  <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-tight">{item.unit || "EA"}</span>
                                </div>
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
                                openDeleteDialog(item)
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
                              <ItemImage
                                itemId={item.id}
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
                                <div className="flex items-baseline gap-1.5 justify-center">
                                  <p className="text-2xl font-semibold tabular-nums text-right min-w-[3ch]">{item.onHand}</p>
                                  <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-tight w-[4ch] text-left">{item.unit || "EA"}</span>
                                </div>
                              </div>
                              <div className="text-center min-w-[70px]">
                                <p className="text-xs text-muted-foreground mb-1">Cost</p>
                                <p className="text-base font-medium">${item.cost.toFixed(2)}</p>
                              </div>
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
                                    openDeleteDialog(item)
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

      {/* Stock Adjustment Wizard */}
      <StockAdjustmentWizard
        item={adjustmentDialogItem}
        open={adjustmentDialogOpen}
        onClose={() => {
          setAdjustmentDialogOpen(false)
          setAdjustmentDialogItem(null)
        }}
        onSuccess={() => {
          if (currentWorkspaceId) {
            loadItems(currentWorkspaceId)
          }
        }}
      />

      {/* Delete Item Dialog */}
      <DeleteItemDialog
        item={deleteDialogItem}
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeleteDialogItem(null)
          }
        }}
        onSuccess={() => {
          if (currentWorkspaceId) {
            loadItems(currentWorkspaceId)
          }
        }}
      />

      <AddItemDialog
        open={isAddItemOpen}
        onOpenChange={setIsAddItemOpen}
        workspaceId={currentWorkspaceId}
        categories={categories}
        locations={locations}
        suppliers={suppliers}
        onSuccess={() => {
          if (currentWorkspaceId) {
            loadItems(currentWorkspaceId)
          }
        }}
      />

      {/* Transfer Stock Wizard */}
      <TransferStockWizard
        item={transferDialogItem}
        open={transferDialogOpen}
        onClose={() => {
          setTransferDialogOpen(false)
          setTransferDialogItem(null)
        }}
        onSuccess={() => {
          if (currentWorkspaceId) {
            loadItems(currentWorkspaceId)
          }
        }}
        locations={locations}
      />
    </div>
  )
}