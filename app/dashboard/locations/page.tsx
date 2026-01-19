// app/dashboard/locations/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, MapPin, Warehouse, Settings2, Search, MoreVertical } from "lucide-react"
import {
  getLocationsApi,
  deleteLocationApi,
  getWorkspaceStructureApi,
  LocationStructure,
  LocationWithCount,
  LocationTemplate,
} from "@/lib/api/locations.api"
import { AddLocationDialog } from "@/components/addLocationDialog"
import { EditLocationDialog } from "@/components/editLocationDilog"
import { ConfigureStructureDialog } from "@/components/configureStructuredDialog"
import { MobileHeader } from "@/components/mobileHeader"
import { LocationMobileView } from "@/components/locationMobileView"

export default function LocationsPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationWithCount | null>(null)
  const [isConfigureStructureOpen, setIsConfigureStructureOpen] = useState(false)
  const [defaultStructure, setDefaultStructure] = useState<LocationTemplate | null>(null)

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

  const handleCreateSuccess = (location: LocationWithCount) => {
    setLocations([...locations, location])
  }

  const handleEditSuccess = (updatedLocation: LocationWithCount) => {
    setLocations(locations.map((loc) => (loc.id === updatedLocation.id ? updatedLocation : loc)))
  }

  const handleStructureUpdate = (structure: LocationTemplate) => {
    setDefaultStructure(structure)
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
    setIsEditOpen(true)
  }

  const totalCapacity = locations.reduce((sum, loc) => sum + loc.capacity, 0)
  const totalItems = locations.reduce((sum, loc) => sum + (loc._count?.items || 0), 0)
  const utilizationRate = totalCapacity > 0 ? Math.round((totalItems / totalCapacity) * 100) : 0

  const getLocationStructure = (location: LocationWithCount) => {
    return (location.structure as LocationStructure) || []
  }

  return (
    <>
      {/* Mobile Header with Search */}
      <MobileHeader
        title="Locations"
        showAddButton={true}
        onAddClick={() => setIsCreateOpen(true)}
        showSearch={true}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search locations..."
      />

      <div className="min-h-screen bg-background pt-14 lg:pt-0">
        <div className="px-0 lg:px-6 lg:py-6">
          {/* Stats Cards - Mobile Compact / Desktop Cards */}
          <div className="grid grid-cols-4 gap-0 border-b lg:border-0 lg:grid-cols-4 lg:gap-6 mb-0 lg:mb-8">
            {/* Mobile: Compact Stats */}
            <div className="lg:hidden p-3 border-r">
              <div className="text-xs text-muted-foreground mb-1">Locations</div>
              <div className="text-xl font-bold">{locations.length}</div>
            </div>
            <div className="lg:hidden p-3 border-r">
              <div className="text-xs text-muted-foreground mb-1">Capacity</div>
              <div className="text-xl font-bold">{totalCapacity}</div>
            </div>
            <div className="lg:hidden p-3 border-r">
              <div className="text-xs text-muted-foreground mb-1">Items</div>
              <div className="text-xl font-bold">{totalItems}</div>
            </div>
            <div className="lg:hidden p-3">
              <div className="text-xs text-muted-foreground mb-1">Usage</div>
              <div className="text-xl font-bold">{utilizationRate}%</div>
            </div>

            {/* Desktop: Full Cards */}
            <Card className="hidden lg:block border-border/50 bg-card">
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

            <Card className="hidden lg:block border-border/50 bg-card">
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

            <Card className="hidden lg:block border-border/50 bg-card">
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

            <Card className="hidden lg:block border-border/50 bg-card">
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

          {/* Main Locations Card */}
          <div className="border-b lg:border lg:rounded-lg bg-card mb-0">
            <div className="p-0 lg:p-4">
              {/* Header Section - Desktop Only */}
              <div className="hidden lg:flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4 border-b border-border/50 pb-4">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Storage Locations</h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Manage warehouse storage locations and track capacity
                    {defaultStructure && (
                      <span className="block mt-1.5 text-xs font-medium text-primary">
                        Active structure: {defaultStructure.levels.map((l) => l.label).join(" → ")}
                      </span>
                    )}
                  </p>
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
                    onClick={() => setIsConfigureStructureOpen(true)}
                    className="shadow-sm hover:bg-accent/10 hover:border-accent/50 transition-all bg-transparent h-9 sm:h-10"
                  >
                    <Settings2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Configure</span>
                  </Button>

                  <Button
                    className="shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90 h-9 sm:h-10 text-white"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Location</span>
                  </Button>
                </div>
              </div>

              {/* Mobile View */}
              <div className="lg:hidden">
                <LocationMobileView
                  locations={filteredLocations}
                  onEditClick={openEditDialog}
                  onDeleteClick={handleDelete}
                />
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block rounded-lg border border-border/50 overflow-hidden">
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
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AddLocationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        workspaceId={workspaceId}
        defaultStructure={defaultStructure}
        onSuccess={handleCreateSuccess}
        onStructureUpdate={handleStructureUpdate}
      />

      <EditLocationDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        workspaceId={workspaceId}
        location={editingLocation}
        onSuccess={handleEditSuccess}
      />

      <ConfigureStructureDialog
        open={isConfigureStructureOpen}
        onOpenChange={setIsConfigureStructureOpen}
        workspaceId={workspaceId}
        defaultStructure={defaultStructure}
        onSuccess={handleStructureUpdate}
      />
    </>
  )
}