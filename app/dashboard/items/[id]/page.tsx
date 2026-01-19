"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CreateLotDialog } from "@/components/createLotDialog"
import { ItemDetailsTab } from "@/components/itemDetailsTab"
import { ItemLocationsTab } from "@/components/itemLocationsTab"
import { ItemHistoryTab } from "@/components/itemHistoryTab"
import { ItemHeroSection } from "@/components/itemHeroSection"
import { ItemLotsTab } from "@/components/itemLotsTab"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ItemLabelGenerator } from "@/components/itemLabelGenerator"
import { ManageCustomersDialog } from "@/components/manageCustomersDialog"
import { ImagePreviewDialog } from "@/components/imagePreviewDialog"
import { ManageImagesDialog } from "@/components/manageImagesDialog"
import { ManageLocationsDialog } from "@/components/manageLocationsDialog"
import { ArrowLeft, Save, Edit2, Loader2 } from "lucide-react"
import { getItemByIdApi, updateItemApi, type ItemWithDetails } from "@/lib/api/items.api"
import { getLotsByItemApi, type LotWithRelations } from "@/lib/api/lots.api"
import { getCategoriesApi, type CategoryWithCount } from "@/lib/api/categories.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getCustomersApi, type CustomerWithCount } from "@/lib/api/customers.api"
import { BarcodeScannerDialog } from "@/components/barcodeScannerDialog"
import { getItemImagesApi, type ItemImage as APIItemImage } from "@/lib/api/itemImages.api"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { StockLocationAdjustmentDialog } from "@/components/stockLocationAdjustmentDialog"

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
  const [isManageCustomersOpen, setIsManageCustomersOpen] = useState(false)
  const [isManageLocationsOpen, setIsManageLocationsOpen] = useState(false)
  const [isManageImagesOpen, setIsManageImagesOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [images, setImages] = useState<APIItemImage[]>([])

  // Barcode scanning state
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false)

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

  const [lots, setLots] = useState<LotWithRelations[]>([])
  const [lotTracking, setLotTracking] = useState(false)
  const [isCreateLotOpen, setIsCreateLotOpen] = useState(false)

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

          loadImages(itemId)

          // Load lots if lot tracking is enabled
          if (itemData.lotTracking) {
            loadLots(itemId)
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
      if (response.data?.customers) {
        setCustomers(response.data.customers)
      }
    } catch (err) {
      console.error("Failed to load customers:", err)
    }
  }

  const loadLots = async (itemId: string) => {
    try {
      const response = await getLotsByItemApi(itemId)
      if (response.data?.lots) {
        setLots(response.data.lots)
      }
    } catch (err) {
      console.error("Failed to load lots:", err)
      toast.error("Failed to load lots")
    }
  }

  const refreshItemData = async () => {
    try {
      const response = await getItemByIdApi(itemId)
      if (response.data?.item) {
        setItem(response.data.item as ItemWithDetails)
      }
      if (lotTracking) {
        await loadLots(itemId)
      }
    } catch (error) {
      console.error("Failed to refresh item data:", error)
    }
  }

  const handleOpenBarcodeScanner = () => {
    setIsBarcodeScanOpen(true)
  }

  const openAdjustmentDialog = (locationId: string, currentQuantity: number) => {
    setAdjustmentDialog({ open: true, locationId, currentQuantity, lotId: null })
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
        customerIds: item?.customers?.map(c => c.customerId) || [],
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
    }
    setIsEditing(false)
  }

  const handleOpenManageCustomers = () => {
    setIsManageCustomersOpen(true)
  }

  const handleOpenManageLocations = () => {
    setIsManageLocationsOpen(true)
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

  const itemLocationsWithDetails = item.locations?.map(itemLoc => {
    const locationDetails = locations.find(l => l.id === itemLoc.locationId)
    return {
      ...itemLoc,
      location: locationDetails || itemLoc.location
    }
  }) || []

  const totalQuantity = itemLocationsWithDetails.reduce((sum, loc) => sum + (loc.quantity || 0), 0)

  return (
    <div className="min-h-screen bg-muted/30 sm:bg-background pb-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 -ml-1 rounded-full active:bg-muted sm:w-auto sm:px-3 sm:gap-2 sm:rounded-md sm:hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline text-sm font-medium">Back</span>
          </button>

          <h1 className="text-sm font-semibold truncate max-w-[180px] sm:hidden">{item.name}</h1>

          <div className="flex items-center gap-1 sm:gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancel} className="h-9 px-3 text-sm">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-9 px-4 gap-1.5">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span className="hidden sm:inline">Save</span>
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <ItemLabelGenerator item={item} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="sm:px-4 sm:pt-3">
        {/* Hero Section */}
        <ItemHeroSection
          item={item}
          isEditing={isEditing}
          formData={{ name: formData.name }}
          lotTracking={lotTracking}
          images={images}
          totalQuantity={totalQuantity}
          itemLocationsCount={itemLocationsWithDetails.length}
          onFormDataChange={(updatedData) => setFormData({ ...formData, ...updatedData })}
          onImageClick={(imageUrl) => setSelectedImageUrl(imageUrl)}
          onManageImagesOpen={() => setIsManageImagesOpen(true)}
        />

        {/* Tabs Section */}
        <Tabs defaultValue="details" className="mt-2 sm:mt-4 gap-0">
          <div className="bg-card sm:border sm:rounded-t-lg">
            <TabsList className={`w-full grid ${lotTracking ? 'grid-cols-4' : 'grid-cols-3'} h-12 p-0 bg-transparent rounded-none`}>
              <TabsTrigger
                value="details"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs sm:text-sm font-medium"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="locations"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs sm:text-sm font-medium"
              >
                Locations
              </TabsTrigger>
              {lotTracking && (
                <TabsTrigger
                  value="lots"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs sm:text-sm font-medium"
                >
                  Lots ({lots.filter(l => l.status === 'ACTIVE').length})
                </TabsTrigger>
              )}
              <TabsTrigger
                value="history"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs sm:text-sm font-medium"
              >
                History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-0">
            <ItemDetailsTab
              item={item}
              isEditing={isEditing}
              formData={formData}
              lotTracking={lotTracking}
              categories={categories}
              suppliers={suppliers}
              images={images}
              totalQuantity={totalQuantity}
              itemLocationsCount={itemLocationsWithDetails.length}
              onFormDataChange={setFormData}
              onLotTrackingChange={setLotTracking}
              onOpenBarcodeScanner={handleOpenBarcodeScanner}
              onOpenManageImages={() => setIsManageImagesOpen(true)}
              onImageClick={(imageUrl) => setSelectedImageUrl(imageUrl)}
              onOpenManageCustomers={handleOpenManageCustomers}
            />
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="mt-0">
            <ItemLocationsTab
              itemId={itemId}
              itemLocations={item.locations || []}
              locations={locations}
              itemUnit={item.unit}
              onManageLocations={handleOpenManageLocations}
              onAdjustStock={openAdjustmentDialog}
              onItemUpdate={(updatedItem) => setItem(updatedItem)}
              onNavigateToLocation={(locationId) => router.push(`/dashboard/locations/${locationId}`)}
            />
          </TabsContent>

          {/* Lots Tab */}
          {lotTracking && (
            <TabsContent value="lots" className="mt-0">
              <ItemLotsTab
                itemId={itemId}
                lots={lots}
                itemUnit={item.unit}
                onCreateLot={() => setIsCreateLotOpen(true)}
                onNavigateToLot={(lotId) => router.push(`/dashboard/items/${itemId}/lot/${lotId}`)}
              />
            </TabsContent>
          )}

          {/* History Tab */}
          <TabsContent value="history" className="mt-0">
            <ItemHistoryTab transactions={item.transactions || []} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Barcode Scanner Dialog */}
      <BarcodeScannerDialog
        isOpen={isBarcodeScanOpen}
        onClose={() => setIsBarcodeScanOpen(false)}
        currentBarcode={formData.barcode}
        onBarcodeScanned={(barcode) => {
          setFormData({ ...formData, barcode })
        }}
      />

      {/* Stock Adjustment Dialog */}
      <StockLocationAdjustmentDialog
        isOpen={adjustmentDialog.open}
        onClose={() => setAdjustmentDialog({ open: false, locationId: null, currentQuantity: 0 })}
        itemId={itemId}
        locationId={adjustmentDialog.locationId}
        currentQuantity={adjustmentDialog.currentQuantity}
        lotTracking={lotTracking}
        lots={lots}
        onSuccess={refreshItemData}
      />

      {/* Manage Customers Dialog */}
      <ManageCustomersDialog
        isOpen={isManageCustomersOpen}
        onClose={() => setIsManageCustomersOpen(false)}
        itemId={itemId}
        currentCustomerIds={item?.customers?.map(c => c.customerId) || []}
        customers={customers}
        onSuccess={(updatedItem) => setItem(updatedItem)}
      />

      {/* Manage Locations Dialog */}
      <ManageLocationsDialog
        isOpen={isManageLocationsOpen}
        onClose={() => setIsManageLocationsOpen(false)}
        itemId={itemId}
        currentLocationIds={item?.locations?.map(loc => loc.locationId) || []}
        locations={locations}
        onSuccess={(updatedItem) => setItem(updatedItem)}
      />

      {/* Manage Images Dialog */}
      <ManageImagesDialog
        isOpen={isManageImagesOpen}
        onClose={() => setIsManageImagesOpen(false)}
        itemId={itemId}
        images={images}
        onImagesChange={(updatedImages) => setImages(updatedImages)}
        onImageClick={(imageUrl) => setSelectedImageUrl(imageUrl)}
      />

      <ImagePreviewDialog
        imageUrl={selectedImageUrl}
        onClose={() => setSelectedImageUrl(null)}
      />

      {/* Create Lot Dialog */}
      <CreateLotDialog
        isOpen={isCreateLotOpen}
        onClose={() => setIsCreateLotOpen(false)}
        itemId={itemId}
        itemLocations={item?.locations || []}
        suppliers={suppliers}
        locations={locations}
        onSuccess={(updatedItem) => setItem(updatedItem)}
        onLotsReload={() => loadLots(itemId)}
      />
    </div>
  )
}