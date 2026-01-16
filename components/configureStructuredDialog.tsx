"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Settings2, X } from "lucide-react"
import {
    updateWorkspaceStructureApi,
    LocationTemplate,
} from "@/lib/api/locations.api"

interface ConfigureStructureDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    defaultStructure: LocationTemplate | null
    onSuccess: (structure: LocationTemplate) => void
}

export function ConfigureStructureDialog({
    open,
    onOpenChange,
    workspaceId,
    defaultStructure,
    onSuccess,
}: ConfigureStructureDialogProps) {
    const [tempStructureLevels, setTempStructureLevels] = useState<{ id: string; label: string }[]>([
        { id: "1", label: "Zone" },
        { id: "2", label: "Aisle" },
    ])

    // Update temp structure levels when dialog opens or default structure changes
    useEffect(() => {
        if (open) {
            if (defaultStructure && defaultStructure.levels.length > 0) {
                setTempStructureLevels(
                    defaultStructure.levels.map((level, idx) => ({
                        id: idx.toString(),
                        label: level.label,
                    })),
                )
            } else {
                setTempStructureLevels([
                    { id: "1", label: "Zone" },
                    { id: "2", label: "Aisle" },
                ])
            }
        }
    }, [open, defaultStructure])

    const addTempStructureLevel = () => {
        setTempStructureLevels([...tempStructureLevels, { id: Date.now().toString(), label: "" }])
    }

    const removeTempStructureLevel = (id: string) => {
        if (tempStructureLevels.length > 1) {
            setTempStructureLevels(tempStructureLevels.filter((level) => level.id !== id))
        }
    }

    const updateTempStructureLevel = (id: string, label: string) => {
        setTempStructureLevels(tempStructureLevels.map((level) => (level.id === id ? { ...level, label } : level)))
    }

    const saveDefaultStructure = async () => {
        const structure: LocationTemplate = {
            levels: tempStructureLevels.filter((l) => l.label.trim()).map((l) => ({ label: l.label.trim() })),
        }

        if (structure.levels.length === 0) {
            alert("Please add at least one level to your structure")
            return
        }

        try {
            await updateWorkspaceStructureApi({
                workspaceId,
                structure,
            })

            onSuccess(structure)
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to save workspace structure:", error)
            alert(error instanceof Error ? error.message : "Failed to save structure")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-primary" />
                        Configure Default Location Structure
                    </DialogTitle>
                    <DialogDescription>
                        Set up your standard location structure. This will be used as the template for all new locations.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                        <p className="text-sm text-muted-foreground">
                            <strong>How it works:</strong> Define the levels of your location structure (e.g., Building, Floor,
                            Room, Shelf). When creating new locations, you&apos;ll only need to fill in the values for each level.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Structure Levels</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addTempStructureLevel}
                                className="h-8 text-xs bg-transparent"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Level
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {tempStructureLevels.map((level, index) => (
                                <div
                                    key={level.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card"
                                >
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium text-sm flex-shrink-0">
                                        {index + 1}
                                    </span>
                                    <div className="flex-1">
                                        <Input
                                            placeholder="Level name (e.g., Building, Floor, Zone, Aisle, Shelf...)"
                                            value={level.label}
                                            onChange={(e) => updateTempStructureLevel(level.id, e.target.value)}
                                            className="h-10 text-sm"
                                        />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeTempStructureLevel(level.id)}
                                        disabled={tempStructureLevels.length === 1}
                                        className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {tempStructureLevels.some((l) => l.label.trim()) && (
                            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                <p className="text-xs text-muted-foreground mb-2">Preview Structure:</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {tempStructureLevels
                                        .filter((l) => l.label.trim())
                                        .map((level, idx, arr) => (
                                            <div key={level.id} className="flex items-center gap-2">
                                                <span className="px-3 py-1.5 rounded-md bg-primary/10 text-primary font-medium text-sm">
                                                    {level.label}
                                                </span>
                                                {idx < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
                        Cancel
                    </Button>
                    <Button
                        onClick={saveDefaultStructure}
                        disabled={!tempStructureLevels.some((l) => l.label.trim())}
                        size="sm"
                    >
                        Save as Default
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}