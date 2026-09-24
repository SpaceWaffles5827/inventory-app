"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { Building2, ImagePlus, Settings2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/common/page"
import { itemImageUrl } from "@/components/imageItem"
import { CopyButton } from "@/components/items/copy-button"
import { getReorderPoint, type InventoryItemDetails } from "@/components/items/item-utils"
import type { ItemImage as APIItemImage } from "@/lib/api/itemImages.api"
import { formatCurrency, formatDate, formatQuantity, formatRelativeTime, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

interface ItemDetailsTabProps {
  item: InventoryItemDetails
  images: APIItemImage[]
  onOpenManageImages: () => void
  onImageClick: (imageUrl: string) => void
  onOpenManageCustomers: () => void
}

function Detail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

const Muted = ({ children = "—" }: { children?: ReactNode }) => <span className="text-muted-foreground">{children}</span>

/** Read-only item information, photos and linked customers (editing happens in the Edit dialog) */
export function ItemDetailsTab({
  item,
  images,
  onOpenManageImages,
  onImageClick,
  onOpenManageCustomers,
}: ItemDetailsTabProps) {
  const sortedImages = [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder)

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <section className="rounded-xl border bg-card lg:col-span-2">
        <SectionHeader className="border-b px-4 py-3" title="Item information" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:grid-cols-3">
          <Detail label="Item number">
            <span className="flex items-center gap-1">
              <span className="truncate font-mono">{item.itemNumber}</span>
              <CopyButton value={item.itemNumber} label="Copy item number" className="-my-1" />
            </span>
          </Detail>
          <Detail label="Barcode">
            {item.barcode ? (
              <span className="flex items-center gap-1">
                <span className="truncate font-mono">{item.barcode}</span>
                <CopyButton value={item.barcode} label="Copy barcode" className="-my-1" />
              </span>
            ) : (
              <Muted />
            )}
          </Detail>
          <Detail label="Unit">{item.unit || <Muted>Not set</Muted>}</Detail>
          <Detail label="Category">
            {item.category ? (
              <Link href={`/dashboard/categories/${item.category.id}`} className="font-medium hover:underline">
                {item.category.name}
              </Link>
            ) : (
              <Muted>Uncategorized</Muted>
            )}
          </Detail>
          <Detail label="Supplier">{item.supplier?.name ?? <Muted>None</Muted>}</Detail>
          <Detail label="Unit cost">
            <span className="tabular-nums">{formatCurrency(item.cost)}</span>
          </Detail>
          <Detail label="Reorder point">
            <span className="tabular-nums">{formatQuantity(getReorderPoint(item), item.unit)}</span>
            <span className="block text-xs text-muted-foreground">Low stock at or below this</span>
          </Detail>
          <Detail label="Lot tracking">{item.lotTracking ? "On" : <Muted>Off</Muted>}</Detail>
          <Detail label="Added">
            <span title={formatDateTime(item.createdAt)}>{formatDate(item.createdAt)}</span>
            <span className="block text-xs text-muted-foreground" title={formatDateTime(item.updatedAt)}>
              Updated {formatRelativeTime(item.updatedAt)}
            </span>
          </Detail>
          <Detail label="Description" className="col-span-full">
            {item.description ? <p className="whitespace-pre-line leading-relaxed">{item.description}</p> : <Muted>No description</Muted>}
          </Detail>
        </dl>
      </section>

      <div className="space-y-4 lg:space-y-6">
        <section className="rounded-xl border bg-card">
          <SectionHeader
            className="border-b px-4 py-3"
            title="Photos"
            actions={
              <Button variant="ghost" size="sm" onClick={onOpenManageImages}>
                <Settings2 /> Manage
              </Button>
            }
          />
          <div className="p-4">
            {sortedImages.length === 0 ? (
              <button
                type="button"
                onClick={onOpenManageImages}
                className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <ImagePlus className="size-5" />
                Add photos
              </button>
            ) : (
              <ul className="grid grid-cols-4 gap-2 lg:grid-cols-3">
                {sortedImages.map((image) => (
                  <li key={image.id}>
                    <button
                      type="button"
                      onClick={() => onImageClick(itemImageUrl(image.id))}
                      className={cn(
                        "relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        image.isPrimary && "ring-2 ring-primary"
                      )}
                      aria-label={image.isPrimary ? "View primary photo" : "View photo"}
                    >
                      <Image src={itemImageUrl(image.id)} alt="" fill unoptimized sizes="120px" className="object-cover" />
                      {image.isPrimary && (
                        <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Star className="size-3 fill-current" />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <SectionHeader
            className="border-b px-4 py-3"
            title="Customers"
            actions={
              <Button variant="ghost" size="sm" onClick={onOpenManageCustomers}>
                <Settings2 /> Manage
              </Button>
            }
          />
          <div className="p-4">
            {item.customers && item.customers.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {item.customers.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={`/dashboard/customers/${link.customerId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      <Building2 className="size-3 text-muted-foreground" />
                      {link.customer.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not linked to any customer.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
