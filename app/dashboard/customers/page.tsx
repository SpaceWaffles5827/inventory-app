// app/dashboard/customers/page.tsx
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2, Users, Search, Mail, Phone, Building2, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import {
    getCustomersApi,
    createCustomerApi,
    updateCustomerApi,
    deleteCustomerApi,
    type CustomerWithCount,
    type GetCustomersParams,
    type CreateCustomerRequest,
    type UpdateCustomerRequest,
} from "@/lib/api/customers.api"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobileHeader"
import { CustomerMobileView } from "@/components/customerMobileView"

export default function CustomersPage() {
    const router = useRouter()
    const [customers, setCustomers] = useState<CustomerWithCount[]>([])
    const [workspaceId, setWorkspaceId] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState<CustomerWithCount | null>(null)
    const [emailError, setEmailError] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [customerToDelete, setCustomerToDelete] = useState<CustomerWithCount | null>(null)
    const [formData, setFormData] = useState({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    })

    const handleCustomerClick = useCallback((customerId: string) => {
        router.push(`/dashboard/customers/${customerId}`)
    }, [router])

    // Email validation function
    const validateEmail = (email: string): boolean => {
        if (!email.trim()) return true // Empty email is allowed
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email.trim())
    }

    // Memoized input handlers
    const handleInputChange = useCallback((field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }, [])

    const handleStatusChange = useCallback((value: "ACTIVE" | "INACTIVE") => {
        setFormData(prev => ({ ...prev, status: value }))
    }, [])

    const loadCustomers = useCallback(async (workspaceId: string) => {
        try {
            setIsLoading(true)

            const params: GetCustomersParams = {
                workspaceId,
            }

            if (statusFilter !== "ALL") {
                params.status = statusFilter
            }

            const response = await getCustomersApi(params)

            if (response.status === "success" && response.data.customers) {
                setCustomers(response.data.customers)
            }
        } catch (error) {
            console.error("Load customers error:", error)
            toast.error("Failed to load customers", {
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            })
        } finally {
            setIsLoading(false)
        }
    }, [statusFilter])

    // Load customers and stats
    useEffect(() => {
        const workspaceId = localStorage.getItem("currentWorkspaceId")
        if (workspaceId) {
            setWorkspaceId(workspaceId)
            loadCustomers(workspaceId)
        } else {
            setIsLoading(false)
        }
    }, [loadCustomers])

    const filteredCustomers = useMemo(() => {
        return customers.filter(
            (customer) =>
                customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                customer.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [customers, searchQuery])

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex)

    const handleSearchChange = (value: string) => {
        setSearchQuery(value)
        setCurrentPage(1)
    }

    const handleCreate = async () => {
        // Reset email error
        setEmailError("")

        // Validation
        if (!formData.name.trim()) {
            toast.error("Validation Error", {
                description: "Customer name is required"
            })
            return
        }

        if (formData.email.trim() && !validateEmail(formData.email)) {
            setEmailError("Please enter a valid email address")
            toast.error("Validation Error", {
                description: "Please enter a valid email address"
            })
            return
        }

        try {
            setIsSubmitting(true)
            const createData: CreateCustomerRequest = {
                name: formData.name.trim(),
                contactPerson: formData.contactPerson.trim() || undefined,
                email: formData.email.trim() || undefined,
                phone: formData.phone.trim() || undefined,
                address: formData.address.trim() || undefined,
                status: formData.status,
                workspaceId: workspaceId,
            }

            const response = await createCustomerApi(createData)

            if (response.status === "success") {
                toast.success("Customer created successfully")
                setFormData({
                    name: "",
                    contactPerson: "",
                    email: "",
                    phone: "",
                    address: "",
                    status: "ACTIVE",
                })
                setEmailError("")
                setIsCreateOpen(false)
                loadCustomers(workspaceId)
            }
        } catch (error) {
            toast.error("Failed to create customer", {
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = async () => {
        // Reset email error
        setEmailError("")

        // Validation
        if (!formData.name.trim()) {
            toast.error("Validation Error", {
                description: "Customer name is required"
            })
            return
        }

        if (formData.email.trim() && !validateEmail(formData.email)) {
            setEmailError("Please enter a valid email address")
            toast.error("Validation Error", {
                description: "Please enter a valid email address"
            })
            return
        }

        if (!editingCustomer) return

        try {
            setIsSubmitting(true)
            const updateData: UpdateCustomerRequest = {
                name: formData.name.trim(),
                contactPerson: formData.contactPerson.trim() || undefined,
                email: formData.email.trim() || undefined,
                phone: formData.phone.trim() || undefined,
                address: formData.address.trim() || undefined,
                status: formData.status,
                workspaceId,
            }

            const response = await updateCustomerApi(editingCustomer.id, updateData)

            if (response.status === "success") {
                toast.success("Customer updated successfully")
                setFormData({
                    name: "",
                    contactPerson: "",
                    email: "",
                    phone: "",
                    address: "",
                    status: "ACTIVE",
                })
                setEmailError("")
                setEditingCustomer(null)
                setIsEditOpen(false)
                loadCustomers(workspaceId)
            }
        } catch (error) {
            toast.error("Failed to update customer", {
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (customer: CustomerWithCount) => {
        if (customer._count.items > 0) {
            toast.error("Cannot Delete", {
                description: `This customer has ${customer._count.items} associated item(s). Please remove the associations first.`
            })
            return
        }

        setCustomerToDelete(customer)
        setDeleteConfirmOpen(true)
    }

    const confirmDelete = async () => {
        if (!customerToDelete) return

        try {
            const response = await deleteCustomerApi(customerToDelete.id, workspaceId)

            if (response.status === "success") {
                toast.success("Customer deleted successfully")
                loadCustomers(workspaceId)
            }
        } catch (error) {
            toast.error("Failed to delete customer", {
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            })
        } finally {
            setDeleteConfirmOpen(false)
            setCustomerToDelete(null)
        }
    }

    const toggleStatus = useCallback(async (customer: CustomerWithCount) => {
        try {
            const newStatus = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
            const response = await updateCustomerApi(customer.id, {
                status: newStatus,
                workspaceId,
            })

            if (response.status === "success") {
                toast.success(`Customer status changed to ${newStatus}`)
                loadCustomers(workspaceId)
            }
        } catch (error) {
            toast.error("Failed to update customer status", {
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            })
        }
    }, [workspaceId, loadCustomers])

    const openEditDialog = (customer: CustomerWithCount) => {
        setEditingCustomer(customer)
        setFormData({
            name: customer.name,
            contactPerson: customer.contactPerson || "",
            email: customer.email || "",
            phone: customer.phone || "",
            address: customer.address || "",
            status: customer.status,
        })
        setEmailError("")
        setIsEditOpen(true)
    }

    const resetForm = () => {
        setFormData({
            name: "",
            contactPerson: "",
            email: "",
            phone: "",
            address: "",
            status: "ACTIVE",
        })
        setEmailError("")
    }

    const activeCustomers = customers.filter(c => c.status === "ACTIVE").length
    const totalOrders = customers.reduce((sum, c) => sum + (c._count?.items || 0), 0)

    const customersTable = useMemo(() => {
        return (
            <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">Customer Name</TableHead>
                            <TableHead className="font-semibold">Contact Person</TableHead>
                            <TableHead className="font-semibold">Contact Info</TableHead>
                            <TableHead className="text-center font-semibold">Status</TableHead>
                            <TableHead className="text-right font-semibold pr-[18px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedCustomers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    {searchQuery
                                        ? "No customers found matching your search."
                                        : "No customers found. Create your first customer to get started."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedCustomers.map((customer) => (
                                <TableRow
                                    key={customer.id}
                                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                                    onClick={() => handleCustomerClick(customer.id)}
                                >
                                    <TableCell>
                                        <p className="font-medium">{customer.name}</p>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {customer.contactPerson || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1 text-sm">
                                            {customer.email && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Mail className="h-3 w-3" />
                                                    <span className="truncate max-w-[200px]">{customer.email}</span>
                                                </div>
                                            )}
                                            {customer.phone && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Phone className="h-3 w-3" />
                                                    <span>{customer.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                toggleStatus(customer)
                                            }}
                                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 transition-colors ${customer.status === "ACTIVE"
                                                ? "bg-primary/10 text-primary ring-primary/20 hover:bg-primary/20"
                                                : "bg-muted text-muted-foreground ring-border hover:bg-muted/80"
                                                }`}
                                        >
                                            {customer.status === "ACTIVE" ? "Active" : "Inactive"}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="hover:bg-accent/10 hover:text-accent"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openEditDialog(customer)
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
                                                    handleDelete(customer)
                                                }}
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
        )
    }, [paginatedCustomers, searchQuery, handleCustomerClick, toggleStatus])

    return (
        <>
            {/* Mobile Header with Search */}
            <MobileHeader
                title="Customers"
                showAddButton={true}
                onAddClick={() => setIsCreateOpen(true)}
                showSearch={true}
                searchValue={searchQuery}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Search customers..."
            />

            <div className="min-h-screen bg-background pt-14 lg:pt-0">
                <div className="px-0 lg:px-6 lg:py-6">
                    {/* Stats Cards - Mobile Compact / Desktop Cards */}
                    <div className="grid grid-cols-4 gap-0 border-b lg:border-0 lg:grid-cols-4 lg:gap-6 mb-0 lg:mb-8">
                        {/* Mobile: Compact Stats */}
                        <div className="lg:hidden p-3 border-r">
                            <div className="text-xs text-muted-foreground mb-1">Total</div>
                            <div className="text-xl font-bold">{customers.length}</div>
                        </div>
                        <div className="lg:hidden p-3 border-r">
                            <div className="text-xs text-muted-foreground mb-1">Active</div>
                            <div className="text-xl font-bold">{activeCustomers}</div>
                        </div>
                        <div className="lg:hidden p-3 border-r">
                            <div className="text-xs text-muted-foreground mb-1">Orders</div>
                            <div className="text-xl font-bold">{totalOrders}</div>
                        </div>
                        <div className="lg:hidden p-3">
                            <div className="text-xs text-muted-foreground mb-1">Revenue</div>
                            <div className="text-xl font-bold">$0</div>
                        </div>

                        {/* Desktop: Full Cards */}
                        <Card className="hidden lg:block border-border/50 bg-gradient-to-br from-card to-card/50">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
                                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-accent" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-card-foreground">{customers.length}</div>
                                <p className="text-xs text-muted-foreground mt-1">Registered customers</p>
                            </CardContent>
                        </Card>

                        <Card className="hidden lg:block border-border/50 bg-gradient-to-br from-card to-card/50">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Active Customers</CardTitle>
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-primary" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-card-foreground">{activeCustomers}</div>
                                <p className="text-xs text-muted-foreground mt-1">Currently active</p>
                            </CardContent>
                        </Card>

                        <Card className="hidden lg:block border-border/50 bg-gradient-to-br from-card to-card/50">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
                                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                                    <Building2 className="h-4 w-4 text-accent" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-card-foreground">{totalOrders}</div>
                                <p className="text-xs text-muted-foreground mt-1">Total customer orders</p>
                            </CardContent>
                        </Card>

                        <Card className="hidden lg:block border-border/50 bg-gradient-to-br from-card to-card/50">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-primary" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-card-foreground">$0.00</div>
                                <p className="text-xs text-muted-foreground mt-1">Total revenue</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Customers Card */}
                    <div className="border-b lg:border lg:rounded-lg bg-card mb-0">
                        <div className="p-0 lg:p-4">
                            {/* Header Section - Desktop Only */}
                            <div className="hidden lg:flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                                <div>
                                    <h1 className="text-2xl font-bold">Customers</h1>
                                    <p className="text-sm text-muted-foreground">Manage your customer relationships and contact information</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Select
                                        value={statusFilter}
                                        onValueChange={(value: "ALL" | "ACTIVE" | "INACTIVE") => setStatusFilter(value)}
                                    >
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue placeholder="Filter by status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">All Status</SelectItem>
                                            <SelectItem value="ACTIVE">Active</SelectItem>
                                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <div className="relative flex-1 md:w-80">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search customers..."
                                            value={searchQuery}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>

                                    <Dialog open={isCreateOpen} onOpenChange={(open) => {
                                        setIsCreateOpen(open)
                                        if (!open) resetForm()
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button className="shadow-lg shadow-accent/20 text-white">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add Customer
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Create New Customer</DialogTitle>
                                                <DialogDescription>Add a new customer to your inventory management system.</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="name">
                                                            Customer Name <span className="text-destructive">*</span>
                                                        </Label>
                                                        <Input
                                                            id="name"
                                                            placeholder="e.g., Acme Corporation"
                                                            value={formData.name}
                                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="contactPerson">Contact Person</Label>
                                                        <Input
                                                            id="contactPerson"
                                                            placeholder="e.g., John Smith"
                                                            value={formData.contactPerson}
                                                            onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="email">Email</Label>
                                                        <Input
                                                            id="email"
                                                            type="email"
                                                            placeholder="contact@customer.com"
                                                            value={formData.email}
                                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                                            className={emailError ? "border-destructive" : ""}
                                                        />
                                                        {emailError && (
                                                            <div className="flex items-center gap-1 text-xs text-destructive">
                                                                <AlertCircle className="h-3 w-3" />
                                                                <span>{emailError}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="phone">Phone</Label>
                                                        <Input
                                                            id="phone"
                                                            placeholder="+1 (555) 123-4567"
                                                            value={formData.phone}
                                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="address">Address</Label>
                                                    <Input
                                                        id="address"
                                                        placeholder="Full address including street, city, state, and zip code"
                                                        value={formData.address}
                                                        onChange={(e) => handleInputChange('address', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="status">Status</Label>
                                                    <Select
                                                        value={formData.status}
                                                        onValueChange={handleStatusChange}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="ACTIVE">Active</SelectItem>
                                                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                                                    Cancel
                                                </Button>
                                                <Button onClick={handleCreate} disabled={isSubmitting}>
                                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Create Customer
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>

                            {/* Mobile View */}
                            <div className="lg:hidden">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <CustomerMobileView
                                        customers={filteredCustomers}
                                        onEditClick={openEditDialog}
                                        onDeleteClick={handleDelete}
                                        onToggleStatus={toggleStatus}
                                    />
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden lg:block">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <>
                                        {customersTable}

                                        {/* Pagination Controls */}
                                        {filteredCustomers.length > 0 && (
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                                                <div className="text-sm text-muted-foreground">
                                                    Showing <span className="font-medium text-foreground">{startIndex + 1}</span> to{" "}
                                                    <span className="font-medium text-foreground">{Math.min(endIndex, filteredCustomers.length)}</span> of{" "}
                                                    <span className="font-medium text-foreground">{filteredCustomers.length}</span> customers
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
                                                        <Select
                                                            value={itemsPerPage.toString()}
                                                            onValueChange={(value) => {
                                                                setItemsPerPage(Number(value))
                                                                setCurrentPage(1)
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-9 w-[70px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="5">5</SelectItem>
                                                                <SelectItem value="10">10</SelectItem>
                                                                <SelectItem value="25">25</SelectItem>
                                                                <SelectItem value="50">50</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                                            disabled={currentPage === 1}
                                                            className="h-9 w-9 p-0"
                                                        >
                                                            <ChevronLeft className="h-4 w-4" />
                                                        </Button>

                                                        <div className="flex items-center gap-1">
                                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                                .filter((page) => {
                                                                    return (
                                                                        page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)
                                                                    )
                                                                })
                                                                .map((page, index, array) => (
                                                                    <div key={page} className="flex items-center">
                                                                        {index > 0 && array[index - 1] !== page - 1 && (
                                                                            <span className="px-2 text-muted-foreground">...</span>
                                                                        )}
                                                                        <Button
                                                                            variant={currentPage === page ? "default" : "outline"}
                                                                            size="sm"
                                                                            onClick={() => setCurrentPage(page)}
                                                                            className="h-9 w-9 p-0"
                                                                        >
                                                                            {page}
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                        </div>

                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                                            disabled={currentPage === totalPages}
                                                            className="h-9 w-9 p-0"
                                                        >
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Customer Dialog */}
            <Dialog open={isEditOpen} onOpenChange={(open) => {
                setIsEditOpen(open)
                if (!open) {
                    resetForm()
                    setEditingCustomer(null)
                }
            }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Customer</DialogTitle>
                        <DialogDescription>Update customer information and contact details.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">
                                    Customer Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="edit-name"
                                    placeholder="e.g., Acme Corporation"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-contactPerson">Contact Person</Label>
                                <Input
                                    id="edit-contactPerson"
                                    placeholder="e.g., John Smith"
                                    value={formData.contactPerson}
                                    onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    placeholder="contact@customer.com"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className={emailError ? "border-destructive" : ""}
                                />
                                {emailError && (
                                    <div className="flex items-center gap-1 text-xs text-destructive">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>{emailError}</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-phone">Phone</Label>
                                <Input
                                    id="edit-phone"
                                    placeholder="+1 (555) 123-4567"
                                    value={formData.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-address">Address</Label>
                            <Input
                                id="edit-address"
                                placeholder="Full address including street, city, state, and zip code"
                                value={formData.address}
                                onChange={(e) => handleInputChange('address', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={handleStatusChange}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleEdit} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <span className="font-semibold">{customerToDelete?.name}</span>.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Customer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}