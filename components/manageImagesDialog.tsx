"use client"

import { useRef, useState, type DragEvent } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useConfirm } from "@/components/common/confirm-provider"
import { invalidateItemImage, itemImageUrl } from "@/components/imageItem"
import {
  deleteItemImageApi,
  getItemImagesApi,
  setPrimaryImageApi,
  smartUploadImageApi,
  type ItemImage as APIItemImage,
} from "@/lib/api/itemImages.api"
import { getErrorMessage } from "@/lib/api/client"
import { cn } from "@/lib/utils"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

interface ManageImagesDialogProps {
  isOpen: boolean
  onClose: () => void
  itemId: string
  images: APIItemImage[]
  onImagesChange: (images: APIItemImage[]) => void
  onImageClick: (imageUrl: string) => void
  /** Deleting photos is admin-only */
  canDelete?: boolean
}

/** Upload, reorder primary and delete an item's photos */
export function ManageImagesDialog({
  isOpen,
  onClose,
  itemId,
  images,
  onImagesChange,
  onImageClick,
  canDelete = true,
}: ManageImagesDialogProps) {
  const confirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busyImageId, setBusyImageId] = useState<string | null>(null)

  const uploading = uploadProgress !== null

  const refresh = async () => {
    const res = await getItemImagesApi(itemId)
    onImagesChange((res.data?.images ?? []) as APIItemImage[])
    invalidateItemImage(itemId)
  }

  const upload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => ACCEPTED_TYPES.includes(f.type))
    const skipped = fileList.length - files.length
    if (skipped > 0) toast.error(`${skipped} ${skipped === 1 ? "file was" : "files were"} skipped`, { description: "Use JPG, PNG, GIF or WebP images." })
    if (files.length === 0) return

    setUploadProgress(0)
    let uploaded = 0
    try {
      for (let i = 0; i < files.length; i++) {
        await smartUploadImageApi(itemId, files[i], images.length === 0 && i === 0, (progress) =>
          setUploadProgress(Math.round(((i + progress / 100) / files.length) * 100))
        )
        uploaded++
      }
      toast.success(uploaded === 1 ? "Photo uploaded" : `${uploaded} photos uploaded`)
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"), {
        description: uploaded > 0 ? `${uploaded} of ${files.length} photos were uploaded.` : undefined,
      })
    } finally {
      await refresh().catch(() => undefined)
      setUploadProgress(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const makePrimary = async (image: APIItemImage) => {
    setBusyImageId(image.id)
    try {
      await setPrimaryImageApi(image.id)
      onImagesChange(images.map((img) => ({ ...img, isPrimary: img.id === image.id })))
      invalidateItemImage(itemId)
      toast.success("Primary photo updated")
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update the primary photo"))
    } finally {
      setBusyImageId(null)
    }
  }

  const remove = async (image: APIItemImage) => {
    const deleted = await confirm({
      title: "Delete this photo?",
      description: image.isPrimary
        ? "This is the item's primary photo. Another photo will need to be chosen as primary."
        : "The photo will be removed from this item.",
      destructive: true,
      confirmLabel: "Delete photo",
      action: async () => {
        try {
          await deleteItemImageApi(image.id)
        } catch (err) {
          toast.error(getErrorMessage(err, "Couldn't delete the photo"))
          throw err
        }
      },
    })
    if (!deleted) return
    onImagesChange(images.filter((img) => img.id !== image.id))
    toast.success("Photo deleted")
    refresh().catch(() => undefined)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!uploading && e.dataTransfer.files.length > 0) upload(e.dataTransfer.files)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !uploading && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Photos</DialogTitle>
          <DialogDescription>The primary photo is shown in lists and on labels.</DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          {uploading ? (
            <div className="w-full max-w-xs space-y-2">
              <p className="flex items-center justify-center gap-2 text-sm font-medium">
                <Loader2 className="size-4 animate-spin text-primary" /> Uploading… {uploadProgress}%
              </p>
              <Progress value={uploadProgress ?? 0} />
            </div>
          ) : (
            <>
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Drop photos here</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, GIF or WebP</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} data-testid="upload-images-button">
                <ImagePlus /> Choose photos
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
        </div>

        {images.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">No photos yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => {
              const url = itemImageUrl(image.id)
              const busy = busyImageId === image.id
              return (
                <li key={image.id} className="overflow-hidden rounded-lg border bg-card">
                  <button
                    type="button"
                    onClick={() => onImageClick(url)}
                    className="relative block aspect-square w-full bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label="View photo"
                  >
                    <Image src={url} alt="" fill unoptimized sizes="(min-width: 640px) 200px, 50vw" className="object-cover" />
                    {image.isPrimary && (
                      <Badge className="absolute left-2 top-2 gap-1 shadow-sm">
                        <Star className="fill-current" /> Primary
                      </Badge>
                    )}
                  </button>
                  <div className="flex items-center gap-1 p-1.5">
                    {image.isPrimary ? (
                      <span className="flex-1 px-1.5 text-xs text-muted-foreground">Shown in lists</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start text-xs"
                        disabled={busy || uploading}
                        onClick={() => makePrimary(image)}
                      >
                        {busy ? <Loader2 className="animate-spin" /> : <Star />}
                        Make primary
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        disabled={busy || uploading}
                        onClick={() => remove(image)}
                        aria-label="Delete photo"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <DialogFooter>
          <Button onClick={onClose} disabled={uploading}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
