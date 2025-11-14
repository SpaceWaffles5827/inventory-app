"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, History, Edit2, Barcode, Loader2, Users, Building2, Plus, Trash2 } from "lucide-react"
import { getItemByIdApi, updateItemApi, type ItemWithDetails } from "@/lib/api/items.api"
import { getCategoriesApi, type CategoryWithCount } from "@/lib/api/categories.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getCustomersApi, type CustomerWithCount } from "@/lib/api/customers.api"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

type TransactionWithUser = ItemWithDetails['transactions'][number]

export default function ItemDetailPage() {
  const params = useParams()
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
  const [formData, setFormData] = useState({
    itemNumber: "",
    name: "",
    barcode: "",
    description: "",
    cost: "",
    categoryId: "",
    locationId: "",
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
        console.log("=== ITEM LOADED ===")
        console.log("Full response:", JSON.stringify(response, null, 2))

        if (response.data?.item) {
          const itemData = response.data.item as ItemWithDetails
          console.log("Item data:", JSON.stringify(itemData, null, 2))
          console.log("Item customers:", JSON.stringify(itemData.customers, null, 2))

          setItem(itemData)
          setFormData({
            itemNumber: itemData.itemNumber,
            name: itemData.name,
            barcode: itemData.barcode || "",
            description: itemData.description || "",
            cost: itemData.cost.toString(),
            categoryId: itemData.categoryId || "",
            locationId: itemData.locationId || "",
            supplierId: itemData.supplierId || "",
          })

          // Extract customer IDs from the item's customers array
          const customerIds = itemData.customers?.map(c => c.customerId) || []
          console.log("Extracted customer IDs:", customerIds)
          setSelectedCustomerIds(customerIds)
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

  const loadCustomers = async (workspaceId: string) => {
    try {
      const response = await getCustomersApi({ workspaceId, status: "ACTIVE" })
      console.log("=== CUSTOMERS LOADED ===")
      console.log("Customers response:", JSON.stringify(response, null, 2))

      if (response.data?.customers) {
        setCustomers(response.data.customers)
        console.log("Set customers state:", response.data.customers.length, "customers")
      }
    } catch (err) {
      console.error("Failed to load customers:", err)
    }
  }

  const handleAddCustomer = () => {
    console.log("=== ADD CUSTOMER ===")
    console.log("Selected customer ID:", newCustomerId)
    console.log("Current selectedCustomerIds:", selectedCustomerIds)

    if (newCustomerId && !selectedCustomerIds.includes(newCustomerId)) {
      const updatedIds = [...selectedCustomerIds, newCustomerId]
      console.log("Updated customer IDs:", updatedIds)
      setSelectedCustomerIds(updatedIds)
      setNewCustomerId("")
    } else {
      console.log("Customer not added - either empty or already selected")
    }
  }

  const handleRemoveCustomer = (customerId: string) => {
    console.log("=== REMOVE CUSTOMER ===")
    console.log("Removing customer ID:", customerId)
    console.log("Before removal:", selectedCustomerIds)

    const updatedIds = selectedCustomerIds.filter((id) => id !== customerId)
    console.log("After removal:", updatedIds)
    setSelectedCustomerIds(updatedIds)
  }

  const handleUpdateCustomers = async () => {
    console.log("=== UPDATE CUSTOMERS ===")
    console.log("Final selected customer IDs:", selectedCustomerIds)

    setIsSaving(true)
    try {
      const updateData = {
        customerIds: selectedCustomerIds,
      }

      console.log("Updating item with customer data:", updateData)

      const response = await updateItemApi(itemId, updateData)
      console.log("Update response:", JSON.stringify(response, null, 2))

      if (response.data?.item) {
        setItem(response.data.item as ItemWithDetails)
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

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.cost || !formData.itemNumber.trim()) {
      toast.error("Item number, name, and cost are required")
      return
    }

    setIsSaving(true)
    try {
      console.log("=== SAVING ITEM ===")
      console.log("Customer IDs being saved:", selectedCustomerIds)

      const updateData = {
        itemNumber: formData.itemNumber,
        name: formData.name,
        barcode: formData.barcode || undefined,
        description: formData.description || undefined,
        cost: parseFloat(formData.cost),
        categoryId: formData.categoryId || undefined,
        locationId: formData.locationId || undefined,
        supplierId: formData.supplierId || undefined,
        customerIds: selectedCustomerIds,
      }

      console.log("Update payload:", JSON.stringify(updateData, null, 2))

      const response = await updateItemApi(itemId, updateData)
      console.log("Update response:", JSON.stringify(response, null, 2))

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
        categoryId: item.categoryId || "",
        locationId: item.locationId || "",
        supplierId: item.supplierId || "",
      })
      // Reset customer selection
      const customerIds = item.customers?.map(c => c.customerId) || []
      setSelectedCustomerIds(customerIds)
    }
    setIsEditing(false)
  }

  const handleOpenManageCustomers = () => {
    console.log("=== OPENING MANAGE CUSTOMERS ===")
    const currentCustomerIds = item?.customers?.map(c => c.customerId) || []
    console.log("Current item customers:", currentCustomerIds)
    console.log("Available customers:", customers.length)

    setSelectedCustomerIds(currentCustomerIds)
    setNewCustomerId("")
    setIsManageCustomersOpen(true)
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
  console.log("Rendering - selectedCustomerIds:", selectedCustomerIds)
  console.log("Rendering - selectedCustomers:", selectedCustomers.map(c => ({ id: c.id, name: c.name })))

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-8 py-8">
        {/* Back Button */}
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Item Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Item Details</CardTitle>
                    <CardDescription>View and edit item information</CardDescription>
                  </div>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} className="shadow-lg shadow-accent/20">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} className="shadow-lg shadow-accent/20" disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="itemNumber">Item Number</Label>
                    <Input
                      id="itemNumber"
                      value={formData.itemNumber}
                      onChange={(e) => setFormData({ ...formData, itemNumber: e.target.value })}
                      disabled={!isEditing}
                      className={!isEditing ? "font-mono bg-muted" : "font-mono"}
                      placeholder="Enter item number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode" className="flex items-center gap-2">
                      <Barcode className="h-4 w-4" />
                      Barcode
                    </Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      disabled={!isEditing}
                      className="font-mono"
                      placeholder="Enter barcode"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                    placeholder="Enter product name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={!isEditing}
                    rows={3}
                    placeholder="Enter description"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    {isEditing ? (
                      <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                        <SelectTrigger id="category">
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
                      <Input id="category" value={item.category?.name || "Uncategorized"} disabled className="bg-muted" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier</Label>
                    {isEditing ? (
                      <Select value={formData.supplierId} onValueChange={(value) => setFormData({ ...formData, supplierId: value })}>
                        <SelectTrigger id="supplier">
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
                      <Input id="supplier" value={item.supplier?.name || "Unknown"} disabled className="bg-muted" />
                    )}
                  </div>
                </div>

                {/* Customer Management Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Customers</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenManageCustomers}
                      disabled={isEditing}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Manage Customers
                    </Button>
                  </div>
                  {item.customers && item.customers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.customers.map((customerLink) => (
                        <Badge key={customerLink.id} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                          {customerLink.customer.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No customers assigned to this item</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Link this item to specific customers for custom orders or dedicated inventory
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="onHand">On Hand</Label>
                    <Input id="onHand" type="number" value={item.onHand} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">Use stock adjustment from dashboard to change quantity</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Unit Cost</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      disabled={!isEditing}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storageLocation">Storage Location</Label>
                  {isEditing ? (
                    <Select value={formData.locationId} onValueChange={(value) => setFormData({ ...formData, locationId: value })}>
                      <SelectTrigger id="storageLocation">
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
                  ) : (
                    <Input id="storageLocation" value={item.location?.code || "Unassigned"} disabled className="bg-muted" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Info & History */}
          <div className="space-y-6">
            {/* Quick Info Card */}
            <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
              <CardHeader>
                <CardTitle>Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${item.status === "IN_STOCK"
                      ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                      : "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
                      }`}
                  >
                    {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Total Value</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(item.onHand * item.cost)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Linked Customers</span>
                  <span className="font-semibold">{item.customers?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="text-sm">{new Date(item.updatedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Action History */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Action History
                </CardTitle>
                <CardDescription>Recent changes to this item</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {item.transactions && item.transactions.length > 0 ? (
                    item.transactions.map((transaction: TransactionWithUser) => (
                      <div key={transaction.id} className="flex gap-3 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                        <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center flex-0">
                          <History className="h-4 w-4 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {transaction.type === "INPUT" ? "Stock Added" : "Stock Removed"}
                            </p>
                            <span
                              className={`text-xs font-medium ${transaction.type === "INPUT" ? "text-accent" : "text-destructive"
                                }`}
                            >
                              {transaction.type === "INPUT" ? "+" : "-"}
                              {transaction.quantity}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{transaction.user?.name || "Unknown User"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(transaction.createdAt).toLocaleString()}</p>
                          {transaction.reason && (
                            <p className="text-xs text-muted-foreground mt-1 italic">&quot;{transaction.reason}&quot;</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No transaction history available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Manage Customers Dialog */}
      <Dialog open={isManageCustomersOpen} onOpenChange={setIsManageCustomersOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Manage Customers
            </DialogTitle>
            <DialogDescription>
              Link this item to specific customers. Multiple customers can be assigned to track custom orders or
              dedicated inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Customers */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assigned Customers ({selectedCustomerIds.length})</Label>
              {selectedCustomerIds.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No customers assigned yet
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{customer.name}</span>
                          {customer.company && (
                            <p className="text-xs text-muted-foreground">{customer.company}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemoveCustomer(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Customer */}
            <div className="space-y-2">
              <Label htmlFor="addCustomer" className="text-sm font-medium">
                Add Customer
              </Label>
              <div className="flex gap-2">
                <Select value={newCustomerId} onValueChange={(value) => {
                  console.log("Selected new customer ID:", value)
                  setNewCustomerId(value)
                }}>
                  <SelectTrigger id="addCustomer" className="flex-1">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers
                      .filter((c) => !selectedCustomerIds.includes(c.id))
                      .map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div>
                            <div>{customer.name}</div>
                            {customer.company && (
                              <div className="text-xs text-muted-foreground">{customer.company}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddCustomer} disabled={!newCustomerId} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
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
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateCustomers} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}