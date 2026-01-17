"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TransferStockWizard } from "@/components/transferStockWizard"
import { DeleteItemDialog } from "@/components/deleteItemDialog"
import { AddItemDialog } from "@/components/addItemDialog"
import { StockAdjustmentWizard } from "@/components/stockAdjustmentWizard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  Plus,
  Search,
  AlertCircle,
  DollarSign,
  X,
  SlidersHorizontal,
} from "lucide-react"
import { getCategoriesApi } from "@/lib/api/categories.api"
import { getLocationsApi } from "@/lib/api/locations.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { CategoryWithCount } from "@/lib/api/categories.api"
import { LocationWithCount } from "@/lib/api/locations.api"
import { ItemTableView } from "@/components/itemTableview"
import { ItemGridView } from "@/components/itemgridview"
import { ItemListView } from "@/components/itemListView"

export default function DashboardPage() {
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
    <div className="min-h-screen bg-background">
      <div className="px-0 sm:px-6 lg:px-8 py-0 sm:py-6">
        {/* Stats Cards - Mobile Compact / Desktop Cards */}
        <div className="grid grid-cols-3 gap-0 border-b sm:border-0 sm:grid-cols-3 sm:gap-6 mb-0 sm:mb-8">
          {/* Mobile: Compact Stats */}
          <div className="sm:hidden p-3 border-r">
            <div className="text-xs text-muted-foreground mb-1">Items</div>
            <div className="text-xl font-bold">{totalItems}</div>
          </div>
          <div className="sm:hidden p-3 border-r">
            <div className="text-xs text-muted-foreground mb-1">Low Stock</div>
            <div className="text-xl font-bold text-destructive">{lowStockItems}</div>
          </div>
          <div className="sm:hidden p-3">
            <div className="text-xs text-muted-foreground mb-1">Value</div>
            <div className="text-xl font-bold">${(totalValue / 1000).toFixed(1)}k</div>
          </div>

          {/* Desktop: Full Cards */}
          <Card className="hidden sm:block border-border/50 bg-linear-to-br from-card to-card/50">
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

          <Card className="hidden sm:block border-border/50 bg-linear-to-br from-card to-card/50">
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

          <Card className="hidden sm:block border-border/50 bg-linear-to-br from-card to-card/50">
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

        {/* Header Section - Mobile Optimized */}
        <div className="px-3 sm:px-0 py-3 sm:py-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-3xl font-bold">Inventory</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Manage your products and stock levels
            </p>
          </div>
          <Button onClick={() => setIsAddItemOpen(true)} size="sm" className="w-full sm:w-auto shadow-lg shadow-accent/20">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        {/* Filters - Mobile Optimized */}
        <div className="border-b sm:border sm:rounded-lg sm:mb-6 bg-card mb-0">
          <div className="p-3 sm:p-6">
            <div className="flex flex-col gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 sm:h-11 text-sm"
                />
              </div>

              {/* Compact Filter Row - Mobile */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] h-9 text-sm">
                    <SelectValue placeholder="Category" />
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

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px] h-9 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "IN_STOCK" ? "In Stock" : status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={viewMode} onValueChange={(value: "table" | "grid" | "list") => setViewMode(value)}>
                  <SelectTrigger className="w-[100px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="list">List</SelectItem>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Desktop Filters - Hidden on Mobile */}
              <div className="hidden sm:flex items-center gap-3">
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
                <div className="hidden sm:grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg border border-border/50 bg-muted/30">
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

              <div className="text-sm text-muted-foreground px-1 sm:px-0">
                Showing {filteredInventory.length} of {inventory.length} items
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Display - Mobile Optimized */}
        <div className="sm:border sm:rounded-lg bg-card">
          {viewMode === "table" && (
            <ItemTableView
              items={filteredInventory}
              onAdjustmentClick={openAdjustmentDialog}
              onTransferClick={openTransferDialog}
              onDeleteClick={openDeleteDialog}
            />
          )}

          {viewMode === "grid" && (
            <div className="p-3 sm:p-6">
              <ItemGridView
                items={filteredInventory}
                onAdjustmentClick={openAdjustmentDialog}
                onDeleteClick={openDeleteDialog}
              />
            </div>
          )}

          {viewMode === "list" && (
            <ItemListView
              items={filteredInventory}
              onAdjustmentClick={openAdjustmentDialog}
              onDeleteClick={openDeleteDialog}
            />
          )}
        </div>
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