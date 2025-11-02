"use client"

import { useState, useEffect } from "react"
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
import { Plus, Pencil, Trash2, MapPin, Search, Warehouse } from "lucide-react"
import {
  getLocationsApi,
  createLocationApi,
  updateLocationApi,
  deleteLocationApi,
} from "@/lib/api/locations.api"
import { LocationWithCount } from "@/lib/api/locations.api"

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationWithCount | null>(null)
  const [formData, setFormData] = useState({
    zone: "",
    aisle: "",
    shelf: "",
    bin: "",
    capacity: "",
    description: "",
  })
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem("currentWorkspaceId") || "" : ""

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
      location.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (location.description || "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const generateLocationCode = (zone: string, aisle: string, shelf: string, bin: string) => {
    return `${zone}-${aisle}-${shelf}-${bin}`.toUpperCase()
  }

  const handleCreate = async () => {
    if (!formData.zone.trim() || !formData.aisle.trim() || !formData.shelf.trim() || !formData.bin.trim()) return

    try {
      const response = await createLocationApi({
        code: generateLocationCode(formData.zone, formData.aisle, formData.shelf, formData.bin),
        zone: formData.zone.toUpperCase(),
        aisle: formData.aisle.padStart(2, "0"),
        shelf: formData.shelf.padStart(2, "0"),
        bin: formData.bin.toUpperCase(),
        capacity: Number.parseInt(formData.capacity) || 100,
        description: formData.description,
        workspaceId: workspaceId,
      })

      if (response.data?.location) {
        setLocations([...locations, response.data.location])
        setFormData({ zone: "", aisle: "", shelf: "", bin: "", capacity: "", description: "" })
        setIsCreateOpen(false)
      }
    } catch (error) {
      console.error("Failed to create location:", error)
      alert(error instanceof Error ? error.message : "Failed to create location")
    }
  }

  const handleEdit = async () => {
    if (
      !editingLocation ||
      !formData.zone.trim() ||
      !formData.aisle.trim() ||
      !formData.shelf.trim() ||
      !formData.bin.trim()
    )
      return

    try {
      const response = await updateLocationApi(editingLocation.id, {
        code: generateLocationCode(formData.zone, formData.aisle, formData.shelf, formData.bin),
        zone: formData.zone.toUpperCase(),
        aisle: formData.aisle.padStart(2, "0"),
        shelf: formData.shelf.padStart(2, "0"),
        bin: formData.bin.toUpperCase(),
        capacity: Number.parseInt(formData.capacity) || 100,
        description: formData.description,
        workspaceId: workspaceId,
      })

      if (response.data?.location) {
        setLocations(locations.map((loc) => (loc.id === editingLocation.id ? response.data.location! : loc)))
        setFormData({ zone: "", aisle: "", shelf: "", bin: "", capacity: "", description: "" })
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
    setFormData({
      zone: location.zone,
      aisle: location.aisle,
      shelf: location.shelf,
      bin: location.bin,
      capacity: location.capacity.toString(),
      description: location.description || "",
    })
    setIsEditOpen(true)
  }

  const totalCapacity = locations.reduce((sum, loc) => sum + loc.capacity, 0)
  const totalItems = locations.reduce((sum, loc) => sum + (loc._count?.items || 0), 0)
  const utilizationRate = totalCapacity > 0 ? Math.round((totalItems / totalCapacity) * 100) : 0

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8">
        {/* Header Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
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

          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
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

          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
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

          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
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

        {/* Locations Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Storage Locations</CardTitle>
                <CardDescription>Manage warehouse storage locations and track capacity</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search locations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Create Location Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg shadow-accent/20">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Location</DialogTitle>
                      <DialogDescription>
                        Add a new storage location to your warehouse. Location code will be auto-generated.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="zone">Zone *</Label>
                          <Input
                            id="zone"
                            placeholder="A"
                            value={formData.zone}
                            onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                            maxLength={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="aisle">Aisle *</Label>
                          <Input
                            id="aisle"
                            placeholder="01"
                            value={formData.aisle}
                            onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                            maxLength={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shelf">Shelf *</Label>
                          <Input
                            id="shelf"
                            placeholder="01"
                            value={formData.shelf}
                            onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                            maxLength={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bin">Bin *</Label>
                          <Input
                            id="bin"
                            placeholder="A"
                            value={formData.bin}
                            onChange={(e) => setFormData({ ...formData, bin: e.target.value })}
                            maxLength={2}
                          />
                        </div>
                      </div>

                      {formData.zone && formData.aisle && formData.shelf && formData.bin && (
                        <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                          <p className="text-sm text-muted-foreground mb-1">Generated Location Code:</p>
                          <p className="text-lg font-mono font-bold text-accent">
                            {generateLocationCode(formData.zone, formData.aisle, formData.shelf, formData.bin)}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="capacity">Storage Capacity</Label>
                        <Input
                          id="capacity"
                          type="number"
                          placeholder="100"
                          value={formData.capacity}
                          onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Brief description of this location..."
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreate}>Create Location</Button>
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
                    <TableHead className="font-semibold">Zone</TableHead>
                    <TableHead className="font-semibold">Aisle</TableHead>
                    <TableHead className="font-semibold">Shelf</TableHead>
                    <TableHead className="font-semibold">Bin</TableHead>
                    <TableHead className="text-center font-semibold">Capacity</TableHead>
                    <TableHead className="text-center font-semibold">Items</TableHead>
                    <TableHead className="text-center font-semibold">Utilization</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No locations found. Create your first location to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLocations.map((location) => {
                      const currentItems = location._count?.items || 0
                      const utilization = Math.round((currentItems / location.capacity) * 100)
                      const isNearCapacity = utilization >= 80

                      return (
                        <TableRow key={location.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono font-semibold text-accent">{location.code}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                              {location.zone}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">{location.aisle}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{location.shelf}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{location.bin}</TableCell>
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
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-accent/10 hover:text-accent"
                                onClick={() => openEditDialog(location)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDelete(location.id)}
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

        {/* Edit Location Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
              <DialogDescription>Update the location details. Location code will be regenerated.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-zone">Zone *</Label>
                  <Input
                    id="edit-zone"
                    placeholder="A"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-aisle">Aisle *</Label>
                  <Input
                    id="edit-aisle"
                    placeholder="01"
                    value={formData.aisle}
                    onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-shelf">Shelf *</Label>
                  <Input
                    id="edit-shelf"
                    placeholder="01"
                    value={formData.shelf}
                    onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-bin">Bin *</Label>
                  <Input
                    id="edit-bin"
                    placeholder="A"
                    value={formData.bin}
                    onChange={(e) => setFormData({ ...formData, bin: e.target.value })}
                    maxLength={2}
                  />
                </div>
              </div>

              {formData.zone && formData.aisle && formData.shelf && formData.bin && (
                <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">New Location Code:</p>
                  <p className="text-lg font-mono font-bold text-accent">
                    {generateLocationCode(formData.zone, formData.aisle, formData.shelf, formData.bin)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-capacity">Storage Capacity</Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  placeholder="100"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Brief description of this location..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}