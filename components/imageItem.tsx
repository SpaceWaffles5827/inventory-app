"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Package } from "lucide-react"
import { getItemImagesApi, type ItemImage as ItemImageRecord } from "@/lib/api/itemImages.api"
import { cn } from "@/lib/utils"

/** URL of the image binary served by the API */
export function itemImageUrl(imageId: string): string {
  return `/api/items/images/image/${imageId}`
}

// One request per item per session: thumbnails appear in several views (and on the detail page),
// so the lookup is cached and in-flight requests are shared.
const primaryImageCache = new Map<string, Promise<string | null>>()
/** Settled lookups, so remounted thumbnails render instantly instead of flashing a skeleton */
const resolvedImages = new Map<string, string | null>()

function loadPrimaryImageUrl(itemId: string): Promise<string | null> {
  let pending = primaryImageCache.get(itemId)
  if (!pending) {
    pending = getItemImagesApi(itemId)
      .then((res) => {
        const images = (res.data?.images ?? []) as ItemImageRecord[]
        const primary = images.find((img) => img.isPrimary) ?? images[0]
        const url = primary ? itemImageUrl(primary.id) : null
        resolvedImages.set(itemId, url)
        return url
      })
      .catch(() => {
        primaryImageCache.delete(itemId)
        return null
      })
    primaryImageCache.set(itemId, pending)
  }
  return pending
}

/** Forget the cached primary image (call after uploading, deleting or re-ordering an item's images) */
export function invalidateItemImage(itemId: string): void {
  primaryImageCache.delete(itemId)
  resolvedImages.delete(itemId)
}

interface ItemImageProps {
  itemId: string
  alt: string
  /** Size/shape of the thumbnail box, e.g. "size-10 rounded-lg" */
  className?: string
  /** Rendered `sizes` hint for the browser */
  sizes?: string
}

/** Item thumbnail: the primary image, a skeleton while loading, or a package icon when there is none */
export function ItemImage({ itemId, alt, className, sizes = "96px" }: ItemImageProps) {
  const [result, setResult] = useState<{ itemId: string; url: string | null } | null>(() =>
    resolvedImages.has(itemId) ? { itemId, url: resolvedImages.get(itemId) ?? null } : null
  )
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadPrimaryImageUrl(itemId).then((url) => {
      if (!cancelled) setResult({ itemId, url })
    })
    return () => {
      cancelled = true
    }
  }, [itemId])

  const loading = result?.itemId !== itemId
  const url = !loading && result?.url && result.url !== failedUrl ? result.url : null

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-muted text-muted-foreground",
        loading && "animate-pulse",
        className
      )}
    >
      {url ? (
        <Image src={url} alt={alt} fill unoptimized sizes={sizes} className="object-cover" onError={() => setFailedUrl(url)} />
      ) : (
        !loading && <Package aria-hidden className="size-[40%] max-h-8 max-w-8 opacity-60" />
      )}
    </span>
  )
}
