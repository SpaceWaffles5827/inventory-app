"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, MapPin, Warehouse, Settings2, X, Search } from "lucide-react"
import {
  getLocationsApi,
  createLocationApi,
  updateLocationApi,
  deleteLocationApi,
  getWorkspaceStructureApi,
  updateWorkspaceStructureApi,
  LocationStructure,
  LocationWithCount,
} from "@/lib/api/locations.api"

interface LocationLevel {
  id: string
  label: string
  value: string
}

interface LocationTemplate {
  levels: { label: string }[]
}

export default function LocationsPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationWithCount | null>(null)

  const [isConfigureStructureOpen, setIsConfigureStructureOpen] = useState(false)
  const [defaultStructure, setDefaultStructure] = useState<LocationTemplate | null>(null)
  const [tempStructureLevels, setTempStructureLevels] = useState<{ id: string; label: string }[]>([
    { id: "1", label: "Zone" },
    { id: "2", label: "Aisle" },
  ])

  const [locationLevels, setLocationLevels] = useState<LocationLevel[]>([
    { id: "1", label: "Zone", value: "" },
    { id: "2", label: "Aisle", value: "" },
  ])

  const [formData, setFormData] = useState({
    name: "",
    capacity: "",
    description: "",
  })

  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem("currentWorkspaceId") || "" : ""

  // Load default structure from database
  useEffect(() => {
    if (!workspaceId) return

    const fetchWorkspaceStructure = async () => {
      try {
        const response = await getWorkspaceStructureApi(workspaceId)
        if (response.data?.structure) {
          setDefaultStructure(response.data.structure)
        }
      } catch (error) {
        console.error("Failed to fetch workspace structure:", error)
      }
    }

    fetchWorkspaceStructure()
  }, [workspaceId])

  // Fetch locations when workspaceId is available
  useEffect(() => {
    if (!workspaceId) return

    const fetchLocations = async () => {
      try {
        const response = await getLocationsApi(workspaceId)
        if (response.data?.locations) {
          setLocations(response.data.locations)
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error)
      }
    }

    fetchLocations()
  }, [workspaceId])

  const filteredLocations = locations.filter(
    (location) =>
      location.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (location.structure as LocationStructure).some(s => s.value.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (location.description || "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

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

      setDefaultStructure(structure)

      // Update locationLevels if create dialog is open
      if (isCreateOpen) {
        setLocationLevels(
          structure.levels.map((level, idx) => ({
            id: Date.now().toString() + idx,
            label: level.label,
            value: "",
          })),
        )
      }

      setIsConfigureStructureOpen(false)
    } catch (error) {
      console.error("Failed to save workspace structure:", error)
      alert(error instanceof Error ? error.message : "Failed to save structure")
    }
  }

  const saveDefaultStructureFromModal = async () => {
    const structure: LocationTemplate = {
      levels: locationLevels.filter((l) => l.label.trim()).map((l) => ({ label: l.label.trim() })),
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

      setDefaultStructure(structure)

      // Keep the current locationLevels but clear values
      setLocationLevels(
        locationLevels.map((level) => ({
          ...level,
          value: "",
        })),
      )

      alert("Default structure saved successfully!")
    } catch (error) {
      console.error("Failed to save workspace structure:", error)
      alert(error instanceof Error ? error.message : "Failed to save structure")
    }
  }

  const openCreateDialog = () => {
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
    setIsCreateOpen(true)
  }

  const openConfigureDialog = () => {
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
    setIsConfigureStructureOpen(true)
  }

  const handleCreate = async () => {
    const code = generateLocationCode()
    if (!code) return

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
        setLocations([...locations, response.data.location])
        resetForm()
        setIsCreateOpen(false)
      }
    } catch (error) {
      console.error("Failed to create location:", error)
      alert(error instanceof Error ? error.message : "Failed to create location")
    }
  }

  const handleEdit = async () => {
    if (!editingLocation) return

    const code = generateLocationCode()
    if (!code) return

    try {
      const structure: LocationStructure = locationLevels
        .filter((level) => level.value.trim())
        .map((level) => ({
          label: level.label || "Level",
          value: level.value.trim().toUpperCase(),
        }))

      const response = await updateLocationApi(editingLocation.id, {
        code,
        structure,
        capacity: Number.parseInt(formData.capacity) || 100,
        description: formData.description,
        workspaceId: workspaceId,
      })

      if (response.data?.location) {
        setLocations(locations.map((loc) => (loc.id === editingLocation.id ? response.data.location! : loc)))
        resetForm()
        setEditingLocation(null)
        setIsEditOpen(false)
      }
    } catch (error) {
      console.error("Failed to update location:", error)
      alert(error instanceof Error ? error.message : "Failed to update location")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this location? This action cannot be undone.")) {
      return
    }

    try {
      await deleteLocationApi(id, workspaceId)
      setLocations(locations.filter((loc) => loc.id !== id))
    } catch (error) {
      console.error("Failed to delete location:", error)
      alert(error instanceof Error ? error.message : "Failed to delete location")
    }
  }

  const openEditDialog = (location: LocationWithCount) => {
    setEditingLocation(location)

    const structure = location.structure as LocationStructure
    const levels: LocationLevel[] = structure.map((item, idx) => ({
      id: idx.toString(),
      label: item.label,
      value: item.value,
    }))

    setLocationLevels(levels.length > 0 ? levels : [{ id: "1", label: "Zone", value: "" }])

    setFormData({
      name: location.code,
      capacity: location.capacity.toString(),
      description: location.description || "",
    })
    setIsEditOpen(true)
  }

  const resetForm = () => {
    setFormData({ name: "", capacity: "", description: "" })
    setLocationLevels([
      { id: "1", label: "Zone", value: "" },
      { id: "2", label: "Aisle", value: "" },
    ])
  }

  const totalCapacity = locations.reduce((sum, loc) => sum + loc.capacity, 0)
  const totalItems = locations.reduce((sum, loc) => sum + (loc._count?.items || 0), 0)
  const utilizationRate = totalCapacity > 0 ? Math.round((totalItems / totalCapacity) * 100) : 0

  const isFormValid = locationLevels.some((level) => level.value.trim())

  const getLocationStructure = (location: LocationWithCount) => {
    return (location.structure as LocationStructure) || []
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-8 py-8">
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Locations</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{locations.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active storage locations</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Capacity</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Warehouse className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{totalCapacity}</div>
              <p className="text-xs text-muted-foreground mt-1">Total storage capacity</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Items Stored</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">Items across all locations</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Utilization Rate</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Warehouse className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{utilizationRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Storage utilization</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader className="border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Storage Locations</CardTitle>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  Manage warehouse storage locations and track capacity
                  {defaultStructure && (
                    <span className="block mt-1.5 text-xs font-medium text-primary">
                      Active structure: {defaultStructure.levels.map((l) => l.label).join(" → ")}
                    </span>
                  )}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search locations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 sm:h-10 bg-background border-border/50 focus:border-primary/50 transition-colors"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={openConfigureDialog}
                  className="shadow-sm hover:bg-accent/10 hover:border-accent/50 transition-all bg-transparent h-9 sm:h-10"
                >
                  <Settings2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Configure</span>
                </Button>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90 h-9 sm:h-10"
                      onClick={openCreateDialog}
                    >
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Add Location</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0">
                    <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-3 border-b border-border/50">
                      <DialogTitle className="flex items-center gap-2 text-lg">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Settings2 className="h-4 w-4 text-primary" />
                        </div>
                        Create Location
                      </DialogTitle>
                      <DialogDescription className="text-sm mt-1">
                        Build a custom location structure for your warehouse
                      </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
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
                              >
                                <Settings2 className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Save Default</span>
                              </Button>
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

                          {isFormValid && (
                            <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-2.5 flex-shrink-0">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12" />
                              <div className="relative flex items-center gap-2">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                                  <MapPin className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground">Generated Code</p>
                                  <p className="text-base font-mono font-bold text-primary truncate">
                                    {generateLocationCode()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
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
                        onClick={() => setIsCreateOpen(false)}
                        className="h-9 px-5 hover:bg-accent/10 transition-all"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreate}
                        disabled={!isFormValid}
                        className="h-9 px-5 shadow-md hover:shadow-lg transition-all"
                      >
                        Create Location
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Location Code</TableHead>
                    <TableHead className="font-semibold">Structure</TableHead>
                    <TableHead className="text-center font-semibold">Capacity</TableHead>
                    <TableHead className="text-center font-semibold">Items</TableHead>
                    <TableHead className="text-center font-semibold">Utilization</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No locations found. Create your first location to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLocations.map((location) => {
                      const currentItems = location._count?.items || 0
                      const utilization = Math.round((currentItems / location.capacity) * 100)
                      const isNearCapacity = utilization >= 80

                      return (
                        <TableRow
                          key={location.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => router.push(`/dashboard/locations/${location.id}`)}
                        >
                          <TableCell className="font-mono font-semibold text-accent">{location.code}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {getLocationStructure(location).map((part, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground"
                                >
                                  {part.label}: {part.value}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{location.capacity}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{currentItems}</TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isNearCapacity
                                ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
                                : "bg-accent/10 text-accent ring-1 ring-accent/20"
                                }`}
                            >
                              {utilization}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-accent/10 hover:text-accent"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditDialog(location)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(location.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
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

                  {isFormValid && (
                    <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-2.5 flex-shrink-0">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12" />
                      <div className="relative flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Updated Code</p>
                          <p className="text-base font-mono font-bold text-primary truncate">
                            {generateLocationCode()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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
                onClick={() => setIsEditOpen(false)}
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

        <Dialog open={isConfigureStructureOpen} onOpenChange={setIsConfigureStructureOpen}>
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
              <Button variant="outline" onClick={() => setIsConfigureStructureOpen(false)} size="sm">
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
      </div>
    </div>
  )
}