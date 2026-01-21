"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Settings2, MapPin, X } from "lucide-react"
import {
    updateLocationApi,
    LocationStructure,
    LocationWithCount,
} from "@/lib/api/locations.api"

interface LocationLevel {
    id: string
    label: string
    value: string
}

interface EditLocationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    location: LocationWithCount | null
    onSuccess: (location: LocationWithCount) => void
}

export function EditLocationDialog({
    open,
    onOpenChange,
    workspaceId,
    location,
    onSuccess,
}: EditLocationDialogProps) {
    const [locationLevels, setLocationLevels] = useState<LocationLevel[]>([
        { id: "1", label: "Zone", value: "" },
    ])

    const [formData, setFormData] = useState({
        name: "",
        capacity: "",
        description: "",
    })

    // Update form data when location changes
    useEffect(() => {
        if (location) {
            const structure = location.structure as LocationStructure
            const levels: LocationLevel[] = structure.map((item, idx) => ({
                id: idx.toString(),
                label: item.label,
                value: item.value,
            }))

            setLocationLevels(levels.length > 0 ? levels : [{ id: "1", label: "Zone", value: "" }])

            setFormData({
                name: location.code,
                capacity: location.capacity.toString() || "100",
                description: location.description || "",
            })
        }
    }, [location])

    const generateLocationCode = () => {
        const parts = locationLevels.map((level) => {
            const value = level.value.trim()
            if (value) {
                return value.toUpperCase()
            }
            // Use first letter of label as default
            const label = level.label.trim()
            return label ? label.charAt(0).toUpperCase() + "0" : "00"
        })
        return parts.join("-")
    }

    const addLocationLevel = () => {
        setLocationLevels([...locationLevels, { id: Date.now().toString(), label: "", value: "" }])
    }

    const removeLocationLevel = (id: string) => {
        if (locationLevels.length > 1) {
            setLocationLevels(locationLevels.filter((level) => level.id !== id))
        }
    }

    const updateLocationLevel = (id: string, field: "label" | "value", newValue: string) => {
        setLocationLevels(locationLevels.map((level) => (level.id === id ? { ...level, [field]: newValue } : level)))
    }

    const handleEdit = async () => {
        if (!location) return

        const code = generateLocationCode()
        if (!code) return

        try {
            const structure: LocationStructure = locationLevels
                .filter((level) => level.value.trim())
                .map((level) => ({
                    label: level.label || "Level",
                    value: level.value.trim().toUpperCase(),
                }))

            const response = await updateLocationApi(location.id, {
                code,
                structure,
                capacity: Number.parseInt(formData.capacity) || 100,
                description: formData.description,
                workspaceId: workspaceId,
            })

            if (response.data?.location) {
                onSuccess(response.data.location)
                onOpenChange(false)
            }
        } catch (error) {
            console.error("Failed to update location:", error)
            alert(error instanceof Error ? error.message : "Failed to update location")
        }
    }

    const isFormValid = locationLevels.some((level) => level.value.trim())

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0">
                <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-3 border-b border-border/50">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Settings2 className="h-4 w-4 text-primary" />
                        </div>
                        Edit Location
                    </DialogTitle>
                    <DialogDescription className="text-sm mt-1">
                        Modify your location structure and details
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                    <div className="grid lg:grid-cols-2 gap-6 h-full">
                        <div className="space-y-3 flex flex-col">
                            <div className="flex items-center justify-between pb-2 border-b border-border/30">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">Location Structure</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Update your location hierarchy</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addLocationLevel}
                                    className="h-7 text-xs bg-background hover:bg-accent/10 hover:border-accent/50 transition-all"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                </Button>
                            </div>

                            <div className="space-y-2 flex-1 overflow-y-auto">
                                {locationLevels.map((level, index) => (
                                    <div
                                        key={level.id}
                                        className="group flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xs flex-shrink-0">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 flex gap-2">
                                            <div className="flex-1">
                                                <Input
                                                    placeholder="Level name"
                                                    value={level.label}
                                                    onChange={(e) => updateLocationLevel(level.id, "label", e.target.value)}
                                                    className="h-8 text-sm bg-background border-border/50 focus:border-primary/50 transition-colors"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <Input
                                                    placeholder="Code"
                                                    value={level.value}
                                                    onChange={(e) => updateLocationLevel(level.id, "value", e.target.value)}
                                                    maxLength={10}
                                                    className="h-8 text-sm font-mono bg-background border-border/50 focus:border-primary/50 transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeLocationLevel(level.id)}
                                            disabled={locationLevels.length === 1}
                                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-2.5 flex-shrink-0">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12" />
                                <div className="relative flex items-center gap-2">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                                        <MapPin className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground">Updated Code</p>
                                        <p className={`text-base font-mono font-bold truncate ${isFormValid ? 'text-primary' : 'text-muted-foreground/50'}`}>
                                            {isFormValid ? generateLocationCode() : locationLevels.map(() => '--').join(' ')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-3 min-h-0">
                            <div className="pb-2 border-b border-border/30 flex-shrink-0">
                                <h3 className="text-sm font-semibold text-foreground">Description</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Add notes or details about this location</p>
                            </div>

                            <div className="flex flex-col flex-1 space-y-1.5 min-h-0">
                                <Label htmlFor="edit-description" className="text-xs font-medium text-foreground flex-shrink-0">
                                    Location Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                                </Label>
                                <Textarea
                                    id="edit-description"
                                    placeholder="Add any relevant information about this location, such as storage conditions, access restrictions, or special handling requirements..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="flex-1 resize-none bg-background border-border/50 focus:border-primary/50 transition-colors text-sm min-h-0"
                                />
                                <p className="text-xs text-muted-foreground flex-shrink-0">
                                    This information will be visible to all team members with access to this location
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-border/50">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-9 px-5 hover:bg-accent/10 transition-all"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEdit}
                        disabled={!isFormValid}
                        className="h-9 px-5 shadow-md hover:shadow-lg transition-all"
                    >
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}