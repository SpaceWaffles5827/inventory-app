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
    createLocationApi,
    updateWorkspaceStructureApi,
    LocationStructure,
    LocationWithCount,
    LocationTemplate,
} from "@/lib/api/locations.api"
import { toast } from "sonner"

interface LocationLevel {
    id: string
    label: string
    value: string
}

interface AddLocationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    defaultStructure: LocationTemplate | null
    onSuccess: (location: LocationWithCount) => void
    onStructureUpdate: (structure: LocationTemplate) => void
}

export function AddLocationDialog({
    open,
    onOpenChange,
    workspaceId,
    defaultStructure,
    onSuccess,
    onStructureUpdate,
}: AddLocationDialogProps) {
    const [locationLevels, setLocationLevels] = useState<LocationLevel[]>([
        { id: "1", label: "Zone", value: "" },
        { id: "2", label: "Aisle", value: "" },
    ])

    const [formData, setFormData] = useState({
        name: "",
        capacity: "",
        description: "",
    })

    const [isCreating, setIsCreating] = useState(false)

    // Update location levels when dialog opens or default structure changes
    useEffect(() => {
        if (open) {
            if (defaultStructure && defaultStructure.levels.length > 0) {
                setLocationLevels(
                    defaultStructure.levels.map((level, idx) => ({
                        id: Date.now().toString() + idx,
                        label: level.label,
                        value: "",
                    })),
                )
            } else {
                setLocationLevels([
                    { id: "1", label: "Zone", value: "" },
                    { id: "2", label: "Aisle", value: "" },
                ])
            }
        }
    }, [open, defaultStructure])

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

    const saveDefaultStructureFromModal = async () => {
        const structure: LocationTemplate = {
            levels: locationLevels.filter((l) => l.label.trim()).map((l) => ({ label: l.label.trim() })),
        }

        if (structure.levels.length === 0) {
            toast.error("Please add at least one level to your structure")
            return
        }

        try {
            await updateWorkspaceStructureApi({
                workspaceId,
                structure,
            })

            onStructureUpdate(structure)

            // Keep the current locationLevels but clear values
            setLocationLevels(
                locationLevels.map((level) => ({
                    ...level,
                    value: "",
                })),
            )

            toast.success("Default structure saved successfully!")
        } catch (error) {
            console.error("Failed to save workspace structure:", error)
            toast.error("Failed to save structure", {
                description: error instanceof Error ? error.message : "An unexpected error occurred",
            })
        }
    }

    const handleCreate = async () => {
        const code = generateLocationCode()
        if (!code) return

        setIsCreating(true)

        try {
            const structure: LocationStructure = locationLevels
                .filter((level) => level.value.trim())
                .map((level) => ({
                    label: level.label || "Level",
                    value: level.value.trim().toUpperCase(),
                }))

            const response = await createLocationApi({
                code,
                structure,
                capacity: Number.parseInt(formData.capacity) || 100,
                description: formData.description,
                workspaceId: workspaceId,
            })

            if (response.data?.location) {
                onSuccess(response.data.location)
                // Reset form
                setFormData({ name: "", capacity: "", description: "" })
                setLocationLevels([
                    { id: "1", label: "Zone", value: "" },
                    { id: "2", label: "Aisle", value: "" },
                ])
                onOpenChange(false)
            }
        } catch (error) {
            console.error("Failed to create location:", error)
            toast.error("Failed to create location", {
                description: error instanceof Error ? error.message : "An unexpected error occurred",
            })
        } finally {
            setIsCreating(false)
        }
    }

    const isFormValid = locationLevels.some((level) => level.value.trim())

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                enableKeyboardAvoidance={true}
                hideClose={true}
                className="max-w-5xl max-h-[85vh] flex flex-col p-0 sm:p-6"
                data-testid="add-location-dialog"
            >
                {/* Header */}
                <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-3 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-b">
                    {/* Mobile Header with Actions */}
                    <div className="flex items-center justify-between gap-2 sm:hidden">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={isCreating}
                            className="h-9"
                            data-testid="cancel-button-mobile"
                        >
                            Cancel
                        </Button>
                        <DialogTitle className="text-base font-semibold">Create Location</DialogTitle>
                        <Button
                            size="sm"
                            onClick={handleCreate}
                            disabled={!isFormValid || isCreating}
                            className="h-9"
                            data-testid="submit-button-mobile"
                        >
                            {isCreating ? "Creating..." : "Create"}
                        </Button>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden sm:block">
                        <DialogTitle className="flex items-center gap-2 text-lg" data-testid="dialog-title">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Settings2 className="h-4 w-4 text-primary" />
                            </div>
                            Create Location
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                            Build a custom location structure for your warehouse
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 min-h-0">
                    <div className="grid lg:grid-cols-2 gap-6 h-full">
                        <div className="space-y-3 flex flex-col">
                            <div className="flex items-center justify-between pb-2 border-b border-border/30">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">Location Structure</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Define your location hierarchy</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={saveDefaultStructureFromModal}
                                        className="h-7 text-xs bg-background hover:bg-accent/10 hover:border-accent/50 transition-all"
                                        data-testid="save-default-structure-button"
                                    >
                                        <Settings2 className="h-3 w-3 sm:mr-1" />
                                        <span className="hidden sm:inline">Save Default</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={addLocationLevel}
                                        className="h-7 text-xs bg-background hover:bg-accent/10 hover:border-accent/50 transition-all"
                                        data-testid="add-location-level-button"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 flex-1 overflow-y-auto" data-testid="location-levels-container">
                                {locationLevels.map((level, index) => (
                                    <div
                                        key={level.id}
                                        className="group flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all"
                                        data-testid={`location-level-${index}`}
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
                                                    autoComplete="off"
                                                    autoCorrect="off"
                                                    autoCapitalize="off"
                                                    spellCheck="false"
                                                    data-testid={`location-level-label-${index}`}
                                                />
                                            </div>
                                            <div className="w-24">
                                                <Input
                                                    placeholder="Code"
                                                    value={level.value}
                                                    onChange={(e) => updateLocationLevel(level.id, "value", e.target.value)}
                                                    maxLength={10}
                                                    className="h-8 text-sm font-mono bg-background border-border/50 focus:border-primary/50 transition-colors"
                                                    autoComplete="off"
                                                    autoCorrect="off"
                                                    autoCapitalize="off"
                                                    spellCheck="false"
                                                    data-testid={`location-level-value-${index}`}
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeLocationLevel(level.id)}
                                            disabled={locationLevels.length === 1}
                                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0 transition-all opacity-0 group-hover:opacity-100"
                                            data-testid={`remove-location-level-${index}`}
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
                                        <p className="text-xs text-muted-foreground">Generated Code</p>
                                        <p
                                            className={`text-base font-mono font-bold truncate ${isFormValid ? 'text-primary' : 'text-muted-foreground/50'}`}
                                            data-testid="generated-location-code"
                                        >
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
                                <Label htmlFor="description" className="text-xs font-medium text-foreground flex-shrink-0">
                                    Location Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                                </Label>
                                <Textarea
                                    id="description"
                                    placeholder="Storage conditions, access restrictions, handling notes..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="flex-1 resize-none bg-background border-border/50 focus:border-primary/50 transition-colors text-sm min-h-0"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    data-testid="location-description-input"
                                />
                                <p className="text-xs text-muted-foreground flex-shrink-0">
                                    This information will be visible to all team members with access to this location
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - Desktop Only */}
                <DialogFooter className="hidden sm:flex flex-shrink-0 px-6 pb-5 pt-3 border-t border-border/50">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isCreating}
                        className="h-9 px-5 hover:bg-accent/10 transition-all"
                        data-testid="cancel-button-desktop"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!isFormValid || isCreating}
                        className="h-9 px-5 shadow-md hover:shadow-lg transition-all"
                        data-testid="submit-button-desktop"
                    >
                        {isCreating ? "Creating..." : "Create Location"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
