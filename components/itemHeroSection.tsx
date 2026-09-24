"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRightLeft,
  Boxes,
  DollarSign,
  Diff,
  ImagePlus,
  Images,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Printer,
  Tag,
  Target,
  Trash2,
  Truck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { StockStatusBadge } from "@/components/common/status-badge"
import { itemImageUrl } from "@/components/imageItem"
import { CopyButton } from "@/components/items/copy-button"
import {
  getExpiry,
  getItemStatus,
  getItemValue,
  getReorderPoint,
  stockedLocations,
  type InventoryItemDetails,
} from "@/components/items/item-utils"
import type { ItemImage as APIItemImage } from "@/lib/api/itemImages.api"
import { isHiddenLot } from "@/components/items/items-data"
import type { LotWithRelations } from "@/lib/api/lots.api"
import { formatCurrency, formatCurrencyCompact, formatNumber, formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"

interface ItemHeroSectionProps {
  item: InventoryItemDetails
  images: APIItemImage[]
  lots: LotWithRelations[]
  /** Delete is admin-only */
  isAdmin: boolean
  onAdjust: () => void
  onTransfer: () => void
  onEdit: () => void
  onPrintLabels: () => void
  onManageImages: () => void
  onDelete: () => void
  onImageClick: (imageUrl: string) => void
}

const STATUS_TONE = { IN_STOCK: "success", LOW_STOCK: "warning", OUT_OF_STOCK: "danger" } as const

/** Item page header (title, badges, actions) plus the key-figure cards */
export function ItemHeroSection({
  item,
  images,
  lots,
  isAdmin,
  onAdjust,
  onTransfer,
  onEdit,
  onPrintLabels,
  onManageImages,
  onDelete,
  onImageClick,
}: ItemHeroSectionProps) {
  const status = getItemStatus(item)
  const reorderPoint = getReorderPoint(item)
  const stocked = stockedLocations(item)
  const assignedCount = item.locations?.length ?? 0
  const primary = images.find((img) => img.isPrimary) ?? images[0]
  const primaryUrl = primary ? itemImageUrl(primary.id) : null
  const visibleLots = lots.filter((l) => !isHiddenLot(l))
  const activeLots = visibleLots.filter((l) => l.status === "ACTIVE")
  const expiringLots = activeLots.filter((l) => {
    const expiry = getExpiry(l.expirationDate)
    return expiry !== null && expiry.tone !== "default"
  })

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/items", label: "Inventory" }}
        title={item.name}
        description={
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-sm">{item.itemNumber}</span>
            <CopyButton value={item.itemNumber} label="Copy item number" />
          </span>
        }
        meta={
          <>
            <StockStatusBadge status={status} />
            {item.category && (
              <Badge variant="outline" asChild>
                <Link href={`/dashboard/categories/${item.category.id}`}>
                  <Tag /> {item.category.name}
                </Link>
              </Badge>
            )}
            {item.supplier && (
              <Badge variant="outline">
                <Truck /> {item.supplier.name}
              </Badge>
            )}
            {item.lotTracking && (
              <Badge variant="info">
                <PackageCheck /> Lot tracked
              </Badge>
            )}
          </>
        }
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button className="flex-1 sm:flex-none" onClick={onAdjust} data-testid="item-adjust-stock-button">
              <Diff /> Adjust stock
            </Button>
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={onTransfer} data-testid="item-transfer-stock-button">
              <ArrowRightLeft /> Transfer
            </Button>
            <Button variant="outline" onClick={onEdit} aria-label="Edit item" data-testid="edit-item-button">
              <Pencil />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions" data-testid="item-more-actions-button">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={onPrintLabels} data-testid="item-print-labels-button">
                  <Printer /> Print labels
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onManageImages}>
                  <Images /> Manage photos
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={onDelete} data-testid="item-delete-menu-button">
                      <Trash2 /> Delete item
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4",
          item.lotTracking ? "xl:grid-cols-6" : "xl:grid-cols-5"
        )}
      >
        <button
          type="button"
          onClick={() => (primaryUrl ? onImageClick(primaryUrl) : onManageImages())}
          className={cn(
            "relative min-h-28 overflow-hidden rounded-xl border bg-muted text-muted-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // fills the empty cell the odd number of stat cards would leave
            !item.lotTracking && "row-span-2 xl:row-span-1"
          )}
          aria-label={primaryUrl ? "View photo" : "Add a photo"}
        >
          {primaryUrl ? (
            <Image src={primaryUrl} alt={item.name} fill unoptimized sizes="(min-width: 1280px) 200px, (min-width: 640px) 33vw, 50vw" className="object-cover" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1.5">
              <ImagePlus className="size-6" />
              <span className="text-xs font-medium">Add photo</span>
            </span>
          )}
          {images.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm">
              {images.length} photos
            </span>
          )}
        </button>

        <StatCard
          label="On hand"
          icon={Boxes}
          tone={STATUS_TONE[status]}
          value={
            <>
              {formatNumber(item.onHand)}
              {item.unit && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{item.unit}</span>}
            </>
          }
          hint={status === "OUT_OF_STOCK" ? "Out of stock" : status === "LOW_STOCK" ? "At or below reorder point" : "Healthy stock"}
          data-testid="item-on-hand-stat"
        />
        <StatCard
          label="Value"
          icon={DollarSign}
          value={formatCurrencyCompact(getItemValue(item))}
          hint={`${formatCurrency(item.cost)} each`}
        />
        <StatCard
          label="Locations"
          icon={MapPin}
          value={formatNumber(stocked.length)}
          hint={
            assignedCount === 0
              ? "None assigned"
              : stocked.length === 0
                ? `${assignedCount} assigned, all empty`
                : stocked.length === 1
                  ? `All in ${stocked[0].location.code}`
                  : `Most in ${stocked[0].location.code}`
          }
        />
        {item.lotTracking && (
          <StatCard
            label="Active lots"
            icon={PackageCheck}
            tone={expiringLots.length > 0 ? "warning" : "default"}
            value={formatNumber(activeLots.length)}
            hint={
              expiringLots.length > 0
                ? `${expiringLots.length} expiring or expired`
                : `${formatNumber(visibleLots.length)} lots in total`
            }
          />
        )}
        <StatCard
          label="Reorder point"
          icon={Target}
          tone={item.onHand <= reorderPoint ? "warning" : "default"}
          value={formatNumber(reorderPoint)}
          hint={
            item.onHand <= reorderPoint
              ? "Time to reorder"
              : `${formatQuantity(item.onHand - reorderPoint, item.unit)} above it`
          }
        />
      </div>
    </>
  )
}
