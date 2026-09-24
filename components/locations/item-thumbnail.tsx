"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Package } from "lucide-react"
import { getItemImagesApi } from "@/lib/api/itemImages.api"
import { cn } from "@/lib/utils"

interface ThumbState {
  itemId: string
  url: string | null
}

/** Square item thumbnail using the item's primary image, with a neutral placeholder */
export function ItemThumbnail({ itemId, alt, className }: { itemId: string; alt: string; className?: string }) {
  const [state, setState] = useState<ThumbState | null>(null)
  const [broken, setBroken] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getItemImagesApi(itemId)
      .then((res) => {
        const images: { id: string; isPrimary: boolean }[] = res.data?.images ?? []
        const image = images.find((img) => img.isPrimary) ?? images[0]
        if (!cancelled) setState({ itemId, url: image ? `/api/items/images/image/${image.id}` : null })
      })
      .catch(() => {
        if (!cancelled) setState({ itemId, url: null })
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  const current = state?.itemId === itemId ? state : null
  const url = current?.url && current.url !== broken ? current.url : null

  return (
    <div
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted",
        !current && "animate-pulse",
        className
      )}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          unoptimized
          sizes="64px"
          className="object-cover"
          onError={() => setBroken(url)}
        />
      ) : (
        current && <Package className="size-4 text-muted-foreground" aria-hidden />
      )}
    </div>
  )
}
