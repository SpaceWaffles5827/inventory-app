"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ImagePreviewDialogProps {
  /** Image to show; null closes the dialog */
  imageUrl: string | null
  onClose: () => void
  /** All image URLs of the item, enables previous / next */
  images?: string[]
  alt?: string
}

/** Full-size photo viewer */
export function ImagePreviewDialog({ imageUrl, onClose, images, alt = "Item photo" }: ImagePreviewDialogProps) {
  return (
    <Dialog open={!!imageUrl} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-3 p-3 pt-12 sm:max-w-3xl sm:p-4 sm:pt-12">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
          <DialogDescription>Full-size photo</DialogDescription>
        </DialogHeader>
        {imageUrl && <PreviewBody key={imageUrl} initialUrl={imageUrl} images={images} alt={alt} />}
      </DialogContent>
    </Dialog>
  )
}

function PreviewBody({ initialUrl, images, alt }: { initialUrl: string; images?: string[]; alt: string }) {
  const list = images && images.includes(initialUrl) ? images : [initialUrl]
  const [index, setIndex] = useState(() => Math.max(0, list.indexOf(initialUrl)))
  const url = list[index] ?? initialUrl
  const multiple = list.length > 1

  const go = (delta: number) => setIndex((i) => (i + delta + list.length) % list.length)

  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if (!multiple) return
        if (e.key === "ArrowRight") go(1)
        if (e.key === "ArrowLeft") go(-1)
      }}
    >
      <div className="relative h-[60dvh] w-full overflow-hidden rounded-lg bg-muted sm:h-[70dvh]">
        <Image src={url} alt={alt} fill unoptimized sizes="(min-width: 640px) 768px, 100vw" className="object-contain" />
      </div>
      {multiple && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Previous photo">
            <ChevronLeft />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {index + 1} / {list.length}
          </span>
          <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Next photo">
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}
