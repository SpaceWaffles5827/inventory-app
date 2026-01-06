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
import { ArrowLeft, Save, History, Edit2, Barcode, Loader2, Users, Building2, Plus, Trash2, MapPin, ImageIcon, Hash, Tag, Upload, Star, X } from "lucide-react"
import { getItemByIdApi, updateItemApi, type ItemWithDetails } from "@/lib/api/items.api"
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
  const [isManageLocationsOpen, setIsManageLocationsOpen] = useState(false)
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [newLocationId, setNewLocationId] = useState("")
  const [isManageImagesOpen, setIsManageImagesOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [images, setImages] = useState<APIItemImage[]>([])
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [formData, setFormData] = useState({
    itemNumber: "",
    name: "",
    barcode: "",
    description: "",
    cost: "",
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
        console.log("=== ITEM LOADED ===")
        console.log("Full response:", JSON.stringify(response, null, 2))

        if (response.data?.item) {
          const itemData = response.data.item as ItemWithDetails
          console.log("Item data:", JSON.stringify(itemData, null, 2))
          console.log("Item customers:", JSON.stringify(itemData.customers, null, 2))
          console.log("Item locations:", JSON.stringify(itemData.locations, null, 2))

          setItem(itemData)
          setFormData({
            itemNumber: itemData.itemNumber,
            name: itemData.name,
            barcode: itemData.barcode || "",
            description: itemData.description || "",
            cost: itemData.cost.toString(),
            categoryId: itemData.categoryId || "",
            supplierId: itemData.supplierId || "",
          })

          // Extract customer IDs from the item's customers array
          const customerIds = itemData.customers?.map(c => c.customerId) || []
          console.log("Extracted customer IDs:", customerIds)
          setSelectedCustomerIds(customerIds)

          // Extract location IDs from the locations array
          const locationIds = itemData.locations?.map(loc => loc.locationId) || []
          console.log("Extracted location IDs:", locationIds)
          setSelectedLocationIds(locationIds)

          // Load images for this item
          loadImages(itemId)
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

  const handleAddLocation = () => {
    console.log("=== ADD LOCATION ===")
    console.log("Selected location ID:", newLocationId)
    console.log("Current selectedLocationIds:", selectedLocationIds)

    if (newLocationId && !selectedLocationIds.includes(newLocationId)) {
      const updatedIds = [...selectedLocationIds, newLocationId]
      console.log("Updated location IDs:", updatedIds)
      setSelectedLocationIds(updatedIds)
      setNewLocationId("")
    } else {
      console.log("Location not added - either empty or already selected")
    }
  }

  const handleRemoveLocation = (locationId: string) => {
    console.log("=== REMOVE LOCATION ===")
    console.log("Removing location ID:", locationId)
    console.log("Before removal:", selectedLocationIds)

    const updatedIds = selectedLocationIds.filter((id) => id !== locationId)
    console.log("After removal:", updatedIds)
    setSelectedLocationIds(updatedIds)
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

  const handleUpdateLocations = async () => {
    console.log("=== UPDATE LOCATIONS ===")
    console.log("Final selected location IDs:", selectedLocationIds)

    setIsSaving(true)
    try {
      const updateData = {
        locationIds: selectedLocationIds,
      }

      console.log("Updating item with location data:", updateData)

      const response = await updateItemApi(itemId, updateData)
      console.log("Update response:", JSON.stringify(response, null, 2))

      if (response.data?.item) {
        setItem(response.data.item as ItemWithDetails)
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
        supplierId: item.supplierId || "",
      })
      // Reset customer selection
      const customerIds = item.customers?.map(c => c.customerId) || []
      setSelectedCustomerIds(customerIds)
      // Reset location selection
      const locationIds = item.locations?.map(loc => loc.locationId) || []
      setSelectedLocationIds(locationIds)
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

  const handleOpenManageLocations = () => {
    console.log("=== OPENING MANAGE LOCATIONS ===")
    const currentLocationIds = item?.locations?.map(loc => loc.locationId) || []
    console.log("Current item locations:", currentLocationIds)
    console.log("Available locations:", locations.length)

    setSelectedLocationIds(currentLocationIds)
    setNewLocationId("")
    setIsManageLocationsOpen(true)
  }

  const handleSetPrimaryImage = async (imageId: string) => {
    try {
      await setPrimaryImageApi(imageId)
      // Update local state
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
      // Update local state
      setImages((prev) => prev.filter((img) => img.id !== imageId))
      toast.success("Image deleted")
    } catch (error) {
      console.error("Failed to delete image:", error)
      toast.error("Failed to delete image")
    }
  }

  const handleUploadImages = () => {
    // Trigger file input
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
        // Upload first image as primary if no images exist
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

        // Reload images
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
  const selectedLocations = locations.filter(l => selectedLocationIds.includes(l.id))
  console.log("Rendering - selectedCustomerIds:", selectedCustomerIds)
  console.log("Rendering - selectedCustomers:", selectedCustomers.map(c => ({ id: c.id, name: c.name })))
  console.log("Rendering - selectedLocationIds:", selectedLocationIds)
  console.log("Rendering - selectedLocations:", selectedLocations.map(l => ({ id: l.id, code: l.code })))

  const totalQuantity = item.locations?.reduce((sum, loc) => sum + loc.quantity, 0) || 0
  const primaryImage = images.find((img) => img.isPrimary)
  const primaryImageUrl = primaryImage ? `/api/items/images/image/${primaryImage.id}` : null

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-8 py-8">
        {/* Header with Back Button and Edit Controls */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
          </Link>

          <div className="flex gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="shadow-lg shadow-accent/20">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Item
              </Button>
            ) : (
              <>
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
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <Card className="overflow-hidden mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Product Image - Fixed size */}
              <div className="flex-shrink-0">
                <div
                  className={`relative w-32 h-32 md:w-40 md:h-40 rounded-lg overflow-hidden bg-muted flex items-center justify-center ${isEditing ? "cursor-pointer hover:ring-2 hover:ring-primary transition-all" : primaryImageUrl ? "cursor-pointer hover:ring-2 hover:ring-primary transition-all" : ""
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
                          <Upload className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="h-8 w-8" />
                      {isEditing && <span className="text-xs">Click to upload</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="space-y-4">
                  {/* Item Name */}
                  <div>
                    {isEditing ? (
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="text-2xl font-bold border-dashed"
                        placeholder="Enter item name"
                      />
                    ) : (
                      <h1 className="text-2xl md:text-3xl font-bold text-foreground">{item.name}</h1>
                    )}
                  </div>

                  {/* Badges & Key Info */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Hash className="h-3 w-3" />
                      {item.itemNumber}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Tag className="h-3 w-3" />
                      {item.category?.name || "Uncategorized"}
                    </Badge>
                    <Badge
                      variant={
                        item.status === "IN_STOCK" ? "default" : item.status === "LOW_STOCK" ? "secondary" : "destructive"
                      }
                    >
                      {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                    </Badge>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Quantity</p>
                      <p className="text-xl font-semibold">{totalQuantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Unit Cost</p>
                      <p className="text-xl font-semibold">${item.cost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-xl font-semibold">${(totalQuantity * item.cost).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Locations</p>
                      <p className="text-xl font-semibold">{selectedLocations.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Item Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl">Item Details</CardTitle>
                <CardDescription>View and edit item information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="itemNumber">Item Number</Label>
                    {isEditing ? (
                      <Input
                        id="itemNumber"
                        value={formData.itemNumber}
                        onChange={(e) => setFormData({ ...formData, itemNumber: e.target.value })}
                        className="font-mono"
                        placeholder="Enter item number"
                      />
                    ) : (
                      <div className="text-base font-medium font-mono">{item.itemNumber}</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode" className="flex items-center gap-2">
                      <Barcode className="h-4 w-4" />
                      Barcode
                    </Label>
                    {isEditing ? (
                      <Input
                        id="barcode"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        className="font-mono"
                        placeholder="Enter barcode"
                      />
                    ) : (
                      <div className="text-base font-medium font-mono">{item.barcode || "—"}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  {isEditing ? (
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Enter description"
                    />
                  ) : (
                    <div className="text-base">{item.description || "—"}</div>
                  )}
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
                      <div className="text-base font-medium">{item.category?.name || "Uncategorized"}</div>
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
                      <div className="text-base font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {item.supplier?.name || "Unknown"}
                      </div>
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
                    <div className="text-base font-medium">{totalQuantity}</div>
                    <p className="text-xs text-muted-foreground">Use stock adjustment from dashboard to change quantity</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Unit Cost</Label>
                    {isEditing ? (
                      <Input
                        id="cost"
                        type="number"
                        step="0.01"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="text-base font-medium">${item.cost.toFixed(2)}</div>
                    )}
                  </div>
                </div>

                {/* Location Management Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Storage Locations</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenManageLocations}
                      disabled={isEditing}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Manage Locations
                    </Button>
                  </div>
                  {selectedLocations.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedLocations.map((location) => (
                        <Badge key={location.id} variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                          {location.code}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No locations assigned to this item</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Assign this item to one or more warehouse locations for better organization
                  </p>
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
                    }).format(totalQuantity * item.cost)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Linked Customers</span>
                  <span className="font-semibold">{item.customers?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Locations</span>
                  <span className="font-semibold">{selectedLocations.length}</span>
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
                        <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center p-2">
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

      {/* Manage Locations Dialog */}
      <Dialog open={isManageLocationsOpen} onOpenChange={setIsManageLocationsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              Manage Storage Locations
            </DialogTitle>
            <DialogDescription>
              Assign this item to one or more warehouse locations. This helps organize inventory and track where items are stored.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Locations */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assigned Locations ({selectedLocationIds.length})</Label>
              {selectedLocationIds.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  No locations assigned yet
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedLocations.map((location) => (
                    <div
                      key={location.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium font-mono">{location.code}</span>
                          {location.name && (
                            <p className="text-xs text-muted-foreground">{location.name}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRemoveLocation(location.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Location */}
            <div className="space-y-2">
              <Label htmlFor="addLocation" className="text-sm font-medium">
                Add Location
              </Label>
              <div className="flex gap-2">
                <Select value={newLocationId} onValueChange={(value) => {
                  console.log("Selected new location ID:", value)
                  setNewLocationId(value)
                }}>
                  <SelectTrigger id="addLocation" className="flex-1">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((l) => !selectedLocationIds.includes(l.id))
                      .map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          <div>
                            <div className="font-mono">{location.code}</div>
                            {location.name && (
                              <div className="text-xs text-muted-foreground">{location.name}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddLocation} disabled={!newLocationId} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
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
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateLocations} disabled={isSaving}>
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

      {/* Manage Images Dialog */}
      <Dialog open={isManageImagesOpen} onOpenChange={setIsManageImagesOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              Product Images
            </DialogTitle>
            <DialogDescription>
              Upload and manage photos. The primary image appears on the item card.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Upload Section */}
            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-3 text-center">
                Drag and drop images or click to browse
              </p>
              <Button
                onClick={handleUploadImages}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Select Images
                  </>
                )}
              </Button>
            </div>

            {/* Images Grid */}
            {images.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm font-medium">No images yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload your first product image</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Gallery ({images.length})
                  </h3>
                </div>
                <div className="grid grid-cols-3 gap-3 max-h-[280px] overflow-y-auto pr-1">
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

                      {/* Primary Badge */}
                      {image.isPrimary && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white shadow-lg border-0 text-xs">
                            <Star className="h-2.5 w-2.5 mr-1 fill-current" />
                            Primary
                          </Badge>
                        </div>
                      )}

                      {/* Hover Overlay with Actions */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1.5">
                          {!image.isPrimary ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 bg-white/90 hover:bg-white backdrop-blur-sm h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSetPrimaryImage(image.id)
                              }}
                            >
                              <Star className="h-3 w-3 mr-1" />
                              Set Primary
                            </Button>
                          ) : (
                            <div className="flex-1" />
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="shadow-lg h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteImage(image.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compact Help Text */}
            {images.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Tip:</span> Click to preview • Hover to set primary or delete
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsManageImagesOpen(false)} className="w-full sm:w-auto">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {selectedImageUrl && (
        <Dialog open={!!selectedImageUrl} onOpenChange={() => setSelectedImageUrl(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader className="sr-only">
              <DialogTitle>View Image</DialogTitle>
            </DialogHeader>
            <img
              src={selectedImageUrl}
              alt="Selected Product Image"
              className="w-full max-h-[80vh] object-contain"
            />
            <DialogFooter className="sr-only">
              <Button variant="outline" onClick={() => setSelectedImageUrl(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}