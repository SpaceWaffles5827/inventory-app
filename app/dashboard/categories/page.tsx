// app/dashboard/categories/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, FolderOpen, Search } from "lucide-react"
import {
  getCategoriesApi,
  deleteCategoryApi,
  type CategoryWithCount,
} from "@/lib/api/categories.api"
import { AddCategoryDialog } from "@/components/addCategoryDialog"
import { EditCategoryDialog } from "@/components/editCategoryDialog"
import { MobileHeader } from "@/components/mobileHeader"
import { CategoryMobileView } from "@/components/categoryMobileView"

export default function CategoriesPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null)
  const [workspaceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("currentWorkspaceId") || ""
    }
    return ""
  })

  // Fetch categories when workspaceId is available
  useEffect(() => {
    if (!workspaceId) return

    const fetchCategories = async () => {
      try {
        const response = await getCategoriesApi(workspaceId)
        if (response.data?.categories) {
          setCategories(response.data.categories)
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error)
      }
    }

    fetchCategories()
  }, [workspaceId])

  const filteredCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (category.description || "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleCreateSuccess = (category: CategoryWithCount) => {
    setCategories([...categories, category])
  }

  const handleEditSuccess = (updatedCategory: CategoryWithCount) => {
    setCategories(
      categories.map((cat) => (cat.id === updatedCategory.id ? updatedCategory : cat)),
    )
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category? This action cannot be undone.")) {
      return
    }

    try {
      await deleteCategoryApi(id, workspaceId)
      setCategories(categories.filter((cat) => cat.id !== id))
    } catch (error) {
      console.error("Failed to delete category:", error)
      alert(error instanceof Error ? error.message : "Failed to delete category")
    }
  }

  const openEditDialog = (category: CategoryWithCount) => {
    setEditingCategory(category)
    setIsEditOpen(true)
  }

  const totalItems = categories.reduce((sum, cat) => sum + cat.itemCount, 0)
  const avgItems = categories.length > 0 ? Math.round(totalItems / categories.length) : 0

  return (
    <>
      {/* Mobile Header with Search */}
      <MobileHeader
        title="Categories"
        showAddButton={true}
        onAddClick={() => setIsCreateOpen(true)}
        showSearch={true}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search categories..."
      />

      <div className="min-h-screen bg-background pt-14 lg:pt-0">
        <div className="px-0 lg:px-6 lg:py-6">
          {/* Stats Cards - Mobile Compact / Desktop Cards */}
          <div className="grid grid-cols-3 gap-0 border-b lg:border-0 lg:grid-cols-3 lg:gap-6 mb-0 lg:mb-8">
            {/* Mobile: Compact Stats */}
            <div className="lg:hidden p-4 border-r">
              <div className="text-xs text-muted-foreground mb-1">Categories</div>
              <div className="text-xl font-bold">{categories.length}</div>
            </div>
            <div className="lg:hidden p-4 border-r">
              <div className="text-xs text-muted-foreground mb-1">Items</div>
              <div className="text-xl font-bold">{totalItems}</div>
            </div>
            <div className="lg:hidden p-4">
              <div className="text-xs text-muted-foreground mb-1">Avg/Cat</div>
              <div className="text-xl font-bold">{avgItems}</div>
            </div>

            {/* Desktop: Full Cards */}
            <Card className="hidden lg:block border-border/50 bg-linear-to-br from-card to-card/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Categories</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-card-foreground">{categories.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Active categories</p>
              </CardContent>
            </Card>

            <Card className="hidden lg:block border-border/50 bg-linear-to-br from-card to-card/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-card-foreground">{totalItems}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all categories</p>
              </CardContent>
            </Card>

            <Card className="hidden lg:block border-border/50 bg-linear-to-br from-card to-card/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Items per Category</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-card-foreground">{avgItems}</div>
                <p className="text-xs text-muted-foreground mt-1">Items per category</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Categories Card */}
          <div className="border-b lg:border lg:rounded-lg bg-card mb-0">
            <div className="p-0 lg:p-4">
              {/* Header Section - Desktop Only */}
              <div className="hidden lg:flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold">Categories</h1>
                  <p className="text-sm text-muted-foreground">Organize your inventory with custom categories</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search categories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Button
                    className="shadow-lg shadow-accent/20 text-white"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </div>
              </div>

              {/* Mobile View */}
              <div className="lg:hidden">
                <CategoryMobileView
                  categories={filteredCategories}
                  onEditClick={openEditDialog}
                  onDeleteClick={handleDelete}
                />
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Category Name</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="text-center font-semibold">Items</TableHead>
                      <TableHead className="font-semibold">Created</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No categories found. Create your first category to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCategories.map((category) => (
                        <TableRow
                          key={category.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => router.push(`/dashboard/categories/${category.id}`)}
                        >
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell className="text-muted-foreground max-w-md truncate">
                            {category.description || "No description"}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent ring-1 ring-accent/20">
                              {category.itemCount} items
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(category.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-accent/10 hover:text-accent"
                                onClick={() => openEditDialog(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDelete(category.id)}
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
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AddCategoryDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        workspaceId={workspaceId}
        onSuccess={handleCreateSuccess}
      />

      <EditCategoryDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        workspaceId={workspaceId}
        category={editingCategory}
        onSuccess={handleEditSuccess}
      />
    </>
  )
}