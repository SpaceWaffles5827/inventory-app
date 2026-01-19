// components/locationMobileView.tsx
"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MoreVertical, MapPin } from "lucide-react"
import { LocationWithCount, LocationStructure } from "@/lib/api/locations.api"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface LocationMobileViewProps {
    locations: LocationWithCount[]
    onEditClick: (location: LocationWithCount) => void
    onDeleteClick: (id: string) => void
}

export function LocationMobileView({
    locations,
    onEditClick,
    onDeleteClick
}: LocationMobileViewProps) {
    const router = useRouter()

    const getLocationStructure = (location: LocationWithCount) => {
        return (location.structure as LocationStructure) || []
    }

    if (locations.length === 0) {
        return (
            <div className="text-center py-12 px-4 text-muted-foreground">
                No locations found. Create your first location to get started.
            </div>
        )
    }

    return (
        <div className="divide-y divide-border">
            {locations.map((location) => {
                const currentItems = location._count?.items || 0
                const utilization = Math.round((currentItems / location.capacity) * 100)
                const isNearCapacity = utilization >= 80

                return (
                    <div
                        key={location.id}
                        className="flex items-center gap-3 p-4 active:bg-muted/50 transition-colors"
                        onClick={() => router.push(`/dashboard/locations/${location.id}`)}
                    >
                        {/* Location Icon */}
                        <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-5 w-5 text-accent" />
                        </div>

                        {/* Location Info */}
                        <div className="flex-1 min-w-0">
                            {/* Location Code */}
                            <h3 className="font-mono font-bold text-base leading-tight mb-1">
                                {location.code}
                            </h3>

                            {/* Structure Tags */}
                            <div className="flex flex-wrap gap-1 mb-2">
                                {getLocationStructure(location).slice(0, 2).map((part, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground"
                                    >
                                        {part.label}: {part.value}
                                    </span>
                                ))}
                                {getLocationStructure(location).length > 2 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                        +{getLocationStructure(location).length - 2} more
                                    </span>
                                )}
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-muted-foreground">
                                    {currentItems}/{location.capacity}
                                </span>
                                <span className="text-muted-foreground">|</span>
                                <span
                                    className={`font-medium ${isNearCapacity ? "text-destructive" : "text-accent"
                                        }`}
                                >
                                    {utilization}% used
                                </span>
                            </div>
                        </div>

                        {/* Actions Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="flex-shrink-0 h-10 w-10"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/locations/${location.id}`)}>
                                    View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation()
                                    onEditClick(location)
                                }}>
                                    Edit Location
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDeleteClick(location.id)
                                    }}
                                >
                                    Delete Location
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            })}
        </div>
    )
}