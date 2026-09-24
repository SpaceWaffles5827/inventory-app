"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, PackageX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageContainer } from "@/components/common/page"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { ItemHeroSection } from "@/components/itemHeroSection"
import { ItemDetailsTab } from "@/components/itemDetailsTab"
import { ItemLocationsTab } from "@/components/itemLocationsTab"
import { ItemLotsTab } from "@/components/itemLotsTab"
import { ItemHistoryTab } from "@/components/itemHistoryTab"
import { ItemLabelGenerator } from "@/components/itemLabelGenerator"
import { ImagePreviewDialog } from "@/components/imagePreviewDialog"
import { itemImageUrl } from "@/components/imageItem"
import { ManageImagesDialog } from "@/components/manageImagesDialog"
import { ManageCustomersDialog } from "@/components/manageCustomersDialog"
import { ManageLocationsDialog } from "@/components/manageLocationsDialog"
import { CreateLotDialog } from "@/components/createLotDialog"
import { DeleteItemDialog } from "@/components/deleteItemDialog"
import { StockAdjustmentWizard } from "@/components/stockAdjustmentWizard"
import { StockLocationAdjustmentDialog } from "@/components/stockLocationAdjustmentDialog"
import { TransferStockWizard } from "@/components/transferStockWizard"
import { EditItemDialog } from "@/components/items/edit-item-dialog"
import { STOCK_CHANGED_EVENT } from "@/components/stock/stock-utils"
import { isHiddenLot } from "@/components/items/items-data"
import { replaceSearchParams, type InventoryItemDetails } from "@/components/items/item-utils"
import { getItemByIdApi, type ItemWithDetails } from "@/lib/api/items.api"
import { getItemImagesApi, type ItemImage as APIItemImage } from "@/lib/api/itemImages.api"
import { getLotsByItemApi, type LotWithRelations } from "@/lib/api/lots.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"
import { ApiError, getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"

type TabValue = "details" | "locations" | "lots" | "history"
type DialogName = "edit" | "adjust" | "transfer" | "delete" | "labels" | "images" | "customers" | "locations" | "lot"

const TAB_TRIGGER =
  "-mb-px h-10 flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent px-3 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:text-muted-foreground dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-foreground"

function TabCount({ value }: { value: number }) {
  return <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{value}</span>
}

function parseTab(value: string | null): TabValue {
  return value === "locations" || value === "lots" || value === "history" ? value : "details"
}

export default function ItemDetailPage() {
  // useSearchParams needs a Suspense boundary so the route can still be prerendered
  return (
    <Suspense fallback={<PageSkeleton stats={4} />}>
      <ItemDetailView />
    </Suspense>
  )
}

function ItemDetailView() {
  const { id: itemId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { workspaceId, isAdmin } = useWorkspace()

  const [item, setItem] = useState<InventoryItemDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null)
  const [images, setImages] = useState<APIItemImage[]>([])
  const [lots, setLots] = useState<LotWithRelations[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)
  const [locations, setLocations] = useState<LocationWithCount[]>([])

  const [tab, setTab] = useState<TabValue>(() => parseTab(searchParams.get("tab")))
  const [dialog, setDialog] = useState<DialogName | null>(null)
  const [locationAdjust, setLocationAdjust] = useState<{ open: boolean; locationId: string | null }>({
    open: false,
    locationId: null,
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // ---- data -----------------------------------------------------------------

  const loadItem = useCallback(async () => {
    try {
      const res = await getItemByIdApi(itemId)
      const data = res.data?.item as ItemWithDetails | undefined
      if (!data) throw new ApiError("Item not found", 404)
      setItem(data)
      setError(null)
    } catch (err) {
      setError({
        message: getErrorMessage(err, "Couldn't load this item"),
        notFound: err instanceof ApiError && (err.status === 404 || err.status === 403),
      })
    } finally {
      setLoading(false)
    }
  }, [itemId])

  const loadLots = useCallback(async () => {
    setLotsLoading(true)
    try {
      const res = await getLotsByItemApi(itemId)
      setLots(res.data?.lots ?? [])
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load lots"))
    } finally {
      setLotsLoading(false)
    }
  }, [itemId])

  useEffect(() => {
    loadItem()
  }, [loadItem])

  useEffect(() => {
    let cancelled = false
    getItemImagesApi(itemId)
      .then((res) => {
        if (!cancelled) setImages((res.data?.images ?? []) as APIItemImage[])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [itemId])

  // Workspace locations feed the transfer wizard and the "manage locations" dialog
  useEffect(() => {
    let cancelled = false
    getLocationsApi(workspaceId)
      .then((res) => {
        if (!cancelled) setLocations(res.data?.locations ?? [])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const lotTracking = item?.lotTracking ?? false
  useEffect(() => {
    if (lotTracking) loadLots()
  }, [lotTracking, loadLots])

  /** Reload everything a stock movement can change */
  const refresh = useCallback(async () => {
    await Promise.all([loadItem(), lotTracking ? loadLots() : Promise.resolve()])
  }, [loadItem, loadLots, lotTracking])

  // Stock moved elsewhere (e.g. the global scanner) — refresh quietly
  useEffect(() => {
    const onStockChanged = () => refresh()
    window.addEventListener(STOCK_CHANGED_EVENT, onStockChanged)
    return () => window.removeEventListener(STOCK_CHANGED_EVENT, onStockChanged)
  }, [refresh])

  const retry = () => {
    setLoading(true)
    loadItem()
  }

  const visibleLots = useMemo(() => lots.filter((l) => !isHiddenLot(l)), [lots])
  const imageUrls = useMemo(
    () =>
      [...images]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder)
        .map((img) => itemImageUrl(img.id)),
    [images]
  )
  const quantities = useMemo(
    () => Object.fromEntries((item?.locations ?? []).map((l) => [l.locationId, l.quantity ?? 0])),
    [item]
  )

  const changeTab = (value: string) => {
    const next = parseTab(value)
    setTab(next)
    replaceSearchParams({ tab: next === "details" ? null : next })
  }

  const closeDialog = () => setDialog(null)

  // ---- states ---------------------------------------------------------------

  if (loading) return <PageSkeleton stats={4} />

  if (!item) {
    return (
      <PageContainer>
        {error?.notFound ? (
          <EmptyState
            icon={PackageX}
            title="Item not found"
            description="It may have been deleted, or it belongs to another workspace."
            action={
              <Button asChild>
                <Link href="/dashboard/items">
                  <ArrowLeft /> Back to inventory
                </Link>
              </Button>
            }
          />
        ) : (
          <ErrorState title="Couldn't load this item" message={error?.message} onRetry={retry} />
        )}
      </PageContainer>
    )
  }

  const activeTab: TabValue = tab === "lots" && !item.lotTracking ? "details" : tab
  const activeLotCount = visibleLots.filter((l) => l.status === "ACTIVE").length

  return (
    <PageContainer>
      <ItemHeroSection
        item={item}
        images={images}
        lots={lots}
        isAdmin={isAdmin}
        onAdjust={() => setDialog("adjust")}
        onTransfer={() => setDialog("transfer")}
        onEdit={() => setDialog("edit")}
        onPrintLabels={() => setDialog("labels")}
        onManageImages={() => setDialog("images")}
        onDelete={() => setDialog("delete")}
        onImageClick={setPreviewUrl}
      />

      <Tabs value={activeTab} onValueChange={changeTab} className="mt-6 gap-4">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <TabsList className="h-auto w-full min-w-max justify-start gap-1 rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="details" className={TAB_TRIGGER}>
              Details
            </TabsTrigger>
            <TabsTrigger value="locations" className={TAB_TRIGGER} data-testid="item-locations-tab-trigger">
              Locations <TabCount value={item.locations?.length ?? 0} />
            </TabsTrigger>
            {item.lotTracking && (
              <TabsTrigger value="lots" className={TAB_TRIGGER} data-testid="item-lots-tab-trigger">
                Lots <TabCount value={activeLotCount} />
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className={TAB_TRIGGER} data-testid="item-history-tab-trigger">
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details">
          <ItemDetailsTab
            item={item}
            images={images}
            onOpenManageImages={() => setDialog("images")}
            onImageClick={setPreviewUrl}
            onOpenManageCustomers={() => setDialog("customers")}
          />
        </TabsContent>

        <TabsContent value="locations" data-testid="item-locations-tab-content">
          <ItemLocationsTab
            item={item}
            onManageLocations={() => setDialog("locations")}
            onAdjustStock={(locationId) => setLocationAdjust({ open: true, locationId })}
            onItemUpdate={setItem}
          />
        </TabsContent>

        {item.lotTracking && (
          <TabsContent value="lots" data-testid="item-lots-tab-content">
            <ItemLotsTab
              itemId={item.id}
              lots={lots}
              loading={lotsLoading}
              itemUnit={item.unit}
              onCreateLot={() => setDialog("lot")}
            />
          </TabsContent>
        )}

        <TabsContent value="history">
          <ItemHistoryTab item={item} lots={lots} />
        </TabsContent>
      </Tabs>

      {/* ---- dialogs ---- */}

      <EditItemDialog
        open={dialog === "edit"}
        onOpenChange={(open) => !open && closeDialog()}
        item={item}
        onSaved={setItem}
        canToggleLotTracking={isAdmin}
      />

      <StockAdjustmentWizard item={item} open={dialog === "adjust"} onClose={closeDialog} onSuccess={refresh} />

      <TransferStockWizard
        item={item}
        open={dialog === "transfer"}
        onClose={closeDialog}
        onSuccess={refresh}
        locations={locations}
      />

      <StockLocationAdjustmentDialog
        isOpen={locationAdjust.open}
        onClose={() => setLocationAdjust((s) => ({ ...s, open: false }))}
        itemId={item.id}
        locationId={locationAdjust.locationId}
        onSuccess={refresh}
      />

      <DeleteItemDialog
        item={item}
        open={dialog === "delete"}
        onOpenChange={(open) => !open && closeDialog()}
        onSuccess={() => router.push("/dashboard/items")}
      />

      <ItemLabelGenerator item={item} open={dialog === "labels"} onOpenChange={(open) => !open && closeDialog()} />

      <ManageImagesDialog
        isOpen={dialog === "images"}
        onClose={closeDialog}
        itemId={item.id}
        images={images}
        onImagesChange={setImages}
        onImageClick={setPreviewUrl}
        canDelete={isAdmin}
      />

      <ManageCustomersDialog
        isOpen={dialog === "customers"}
        onClose={closeDialog}
        itemId={item.id}
        currentCustomerIds={item.customers?.map((c) => c.customerId) ?? []}
        onSuccess={setItem}
      />

      <ManageLocationsDialog
        isOpen={dialog === "locations"}
        onClose={closeDialog}
        itemId={item.id}
        currentLocationIds={item.locations?.map((l) => l.locationId) ?? []}
        locations={locations}
        quantities={quantities}
        unit={item.unit}
        onSuccess={setItem}
      />

      <CreateLotDialog
        isOpen={dialog === "lot"}
        onClose={closeDialog}
        itemId={item.id}
        itemLocations={item.locations ?? []}
        unit={item.unit}
        onSuccess={refresh}
      />

      <ImagePreviewDialog imageUrl={previewUrl} onClose={() => setPreviewUrl(null)} images={imageUrls} alt={item.name} />
    </PageContainer>
  )
}
