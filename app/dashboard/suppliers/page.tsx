"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, Users, Search, Mail, Phone } from "lucide-react"
import {
  getSuppliersApi,
  updateSupplierApi,
  deleteSupplierApi,
} from "@/lib/api/suppliers.api"
import type { SupplierWithCount } from "@/lib/api/suppliers.api"
import { AddSupplierDialog } from "@/components/addSupplierDialog"
import { EditSupplierDialog } from "@/components/editSupplierDialog"

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithCount | null>(null)

  // Get workspaceId directly from localStorage
  const workspaceId = typeof window !== 'undefined' ? localStorage.getItem("currentWorkspaceId") : null

  // Fetch suppliers when workspaceId is available
  useEffect(() => {
    if (!workspaceId) return

    const fetchSuppliers = async () => {
      try {
        const response = await getSuppliersApi(workspaceId)
        if (response.data?.suppliers) {
          setSuppliers(response.data.suppliers)
        }
      } catch (error) {
        console.error("Failed to fetch suppliers:", error)
      }
    }

    fetchSuppliers()
  }, [workspaceId])

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.contactPerson || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.email || "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleCreateSuccess = (supplier: SupplierWithCount) => {
    setSuppliers([...suppliers, supplier])
  }

  const handleEditSuccess = (updatedSupplier: SupplierWithCount) => {
    setSuppliers(
      suppliers.map((sup) => (sup.id === updatedSupplier.id ? updatedSupplier : sup)),
    )
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this supplier? This action cannot be undone.")) {
      return
    }

    if (!workspaceId) return

    try {
      await deleteSupplierApi(id, workspaceId)
      setSuppliers(suppliers.filter((sup) => sup.id !== id))
    } catch (error) {
      console.error("Failed to delete supplier:", error)
      alert(error instanceof Error ? error.message : "Failed to delete supplier")
    }
  }

  const toggleStatus = async (supplier: SupplierWithCount) => {
    if (!workspaceId) return

    try {
      const response = await updateSupplierApi(supplier.id, {
        isActive: !supplier.isActive,
        workspaceId: workspaceId,
      })

      if (response.data?.supplier) {
        setSuppliers(
          suppliers.map((sup) => (sup.id === supplier.id ? response.data.supplier! : sup)),
        )
      }
    } catch (error) {
      console.error("Failed to update supplier status:", error)
      alert(error instanceof Error ? error.message : "Failed to update supplier status")
    }
  }

  const openEditDialog = (supplier: SupplierWithCount) => {
    setEditingSupplier(supplier)
    setIsEditOpen(true)
  }

  const activeSuppliers = suppliers.filter((s) => s.isActive).length
  const totalItems = suppliers.reduce((sum, sup) => sum + (sup._count?.items || 0), 0)

  return (
    <div className="min-h-screen">
      <div className="px-8 py-8">
        {/* Header Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{suppliers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered suppliers</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Suppliers</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{activeSuppliers}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently active</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">{totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">From all suppliers</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-linear-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Items per Supplier</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-card-foreground">
                {suppliers.length > 0 ? Math.round(totalItems / suppliers.length) : 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Items per supplier</p>
            </CardContent>
          </Card>
        </div>

        {/* Suppliers Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Suppliers</CardTitle>
                <CardDescription>Manage your supplier relationships and contacts</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Button
                  className="shadow-lg shadow-accent/20 text-white"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Supplier
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Supplier Name</TableHead>
                    <TableHead className="font-semibold">Contact Person</TableHead>
                    <TableHead className="font-semibold">Contact Info</TableHead>
                    <TableHead className="text-center font-semibold">Items</TableHead>
                    <TableHead className="text-center font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No suppliers found. Create your first supplier to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="text-muted-foreground">{supplier.contactPerson || "—"}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            {supplier.email && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-[200px]">{supplier.email}</span>
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{supplier.phone}</span>
                              </div>
                            )}
                            {!supplier.email && !supplier.phone && <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent ring-1 ring-accent/20">
                            {supplier._count?.items || 0} items
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => toggleStatus(supplier)}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 transition-colors ${supplier.isActive
                              ? "bg-primary/10 text-primary ring-primary/20 hover:bg-primary/20"
                              : "bg-muted text-muted-foreground ring-border hover:bg-muted/80"
                              }`}
                          >
                            {supplier.isActive ? "Active" : "Inactive"}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-accent/10 hover:text-accent"
                              onClick={() => openEditDialog(supplier)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDelete(supplier.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add Supplier Dialog */}
        <AddSupplierDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          workspaceId={workspaceId || ""}
          onSuccess={handleCreateSuccess}
        />

        {/* Edit Supplier Dialog */}
        <EditSupplierDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          workspaceId={workspaceId || ""}
          supplier={editingSupplier}
          onSuccess={handleEditSuccess}
        />
      </div>
    </div>
  )
}