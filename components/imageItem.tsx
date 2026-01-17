"use client"

import { useState, useEffect } from "react"
import { ImageIcon, Loader2 } from "lucide-react"

interface ItemImageProps {
    itemId: string
    alt: string
    className?: string
}

export function ItemImage({ itemId, alt, className }: ItemImageProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        const loadPrimaryImage = async () => {
            try {
                setLoading(true)
                setError(false)

                const response = await fetch(`/api/items/images/${itemId}`, {
                    credentials: 'include',
                })

                if (!response.ok) {
                    setError(true)
                    return
                }

                const data = await response.json()
                const primaryImage = data.data?.images?.find((img: any) => img.isPrimary)

                if (primaryImage) {
                    setImageUrl(`/api/items/images/image/${primaryImage.id}`)
                } else {
                    setError(true)
                }
            } catch (err) {
                console.error('Failed to load image:', err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        loadPrimaryImage()
    }, [itemId])

    if (loading) {
        return (
            <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !imageUrl) {
        return (
            <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
        )
    }

    return (
        <img
            src={imageUrl}
            alt={alt}
            className={className}
            onError={() => setError(true)}
        />
    )
}