"use client"

import type React from "react"

import { useState, useEffect, use, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    ArrowLeft,
    Mail,
    Phone,
    MapPin,
    Calendar,
    DollarSign,
    Package,
    Edit2,
    Save,
    Clock,
    Loader2,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    getCustomerByIdApi,
    updateCustomerApi,
    type CustomerWithItems,
    type UpdateCustomerRequest,
} from "@/lib/api/customers.api"

export default function CustomerDetailPage({
    params,
}: {
    params: Promise<{ customerId: string }>
}) {
    const { customerId } = use(params)
    return <CustomerDetailPageClient customerId={customerId} />
}

function CustomerDetailPageClient({ customerId }: { customerId: string }) {
    const router = useRouter()
    const [customer, setCustomer] = useState<CustomerWithItems | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState<Partial<CustomerWithItems> | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [emailError, setEmailError] = useState("")

    // Email validation function
    const validateEmail = (email: string): boolean => {
        if (!email.trim()) return true // Empty email is allowed
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email.trim())
    }

    // Memoized input handlers
    const handleInputChange = useCallback((field: keyof Partial<CustomerWithItems>, value: string) => {
        setFormData(prev => ({ ...prev!, [field]: value }))
    }, [])

    // Fetch customer data
    useEffect(() => {
        const workspaceId = localStorage.getItem("currentWorkspaceId")

        if (!workspaceId) {
            toast.error("No Workspace Selected", {
                description: "Please select a workspace to continue."
            })
            router.push("/dashboard")
            return
        }

        setCurrentWorkspaceId(workspaceId)

        async function fetchCustomer() {
            try {
                setIsLoading(true)
                const response = await getCustomerByIdApi(customerId, workspaceId!)

                if (response.status == 'success' && response.data.customer) {
                    const customerData = response.data.customer as CustomerWithItems
                    setCustomer(customerData)
                    setFormData(customerData)
                }
            } catch (error) {
                console.error("Failed to fetch customer:", error)
                toast.error("Failed to Load Customer", {
                    description: "Unable to load customer details. Please try again."
                })
                router.push("/dashboard/customers")
            } finally {
                setIsLoading(false)
            }
        }

        fetchCustomer()
    }, [customerId, router])

    const handleSave = async () => {
        if (!formData || !customer || !currentWorkspaceId) return

        // Reset email error
        setEmailError("")

        // Validate email format
        if (formData.email && formData.email.trim() && !validateEmail(formData.email)) {
            setEmailError("Please enter a valid email address")
            toast.error("Validation Error", {
                description: "Please enter a valid email address"
            })
            return
        }

        try {
            setIsSaving(true)

            const updateData: UpdateCustomerRequest = {
                name: formData.name,
                contactPerson: formData.contactPerson || undefined,
                email: formData.email || undefined,
                phone: formData.phone || undefined,
                address: formData.address || undefined,
                status: formData.status,
                orderCount: formData.orderCount,
                totalSpent: formData.totalSpent,
                workspaceId: currentWorkspaceId,
            }

            const response = await updateCustomerApi(customer.id, updateData)

            if (response.status == 'success') {
                // Refetch the full customer data with items
                const customerResponse = await getCustomerByIdApi(customerId, currentWorkspaceId!)
                if (customerResponse.status === 'success' && customerResponse.data.customer) {
                    const fullCustomerData = customerResponse.data.customer as CustomerWithItems
                    setCustomer(fullCustomerData)
                    setFormData(fullCustomerData)
                }
                setEmailError("")
                setIsEditing(false)
                toast.success("Customer Updated", {
                    description: `${formData.name}'s details have been successfully updated.`
                })
            } else {
                throw new Error(response.message || "Failed to update customer")
            }
        } catch (error) {
            console.error("Failed to update customer:", error)
            toast.error("Update Failed", {
                description: error instanceof Error ? error.message : "Failed to update customer details. Please try again."
            })
        } finally {
            setIsSaving(false)
        }
    }

    // Pagination for items - memoized
    const customerItems = useMemo(() => customer?.items || [], [customer?.items])
    const totalPages = useMemo(() => Math.ceil(customerItems.length / itemsPerPage), [customerItems.length, itemsPerPage])
    const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage])
    const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage])
    const paginatedItems = useMemo(() => customerItems.slice(startIndex, endIndex), [customerItems, startIndex, endIndex])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <CardTitle>Loading Customer...</CardTitle>
                        </div>
                        <CardDescription>Please wait while we load the customer details.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    if (!customer) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Customer Not Found</CardTitle>
                        <CardDescription>The customer you&apos;re looking for doesn&apos;t exist.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push("/dashboard/customers")}>
                            Back to Customers
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-8 py-8">
                <Button
                    variant="ghost"
                    className="mb-6"
                    onClick={() => router.push("/dashboard/customers")}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Customers
                </Button>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Content - 2 columns */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Customer Details Card */}
                        <Card className="border-border/50">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-2xl">Customer Details</CardTitle>
                                        <CardDescription>View and edit customer information</CardDescription>
                                    </div>
                                    {!isEditing ? (
                                        <Button onClick={() => setIsEditing(true)} className="shadow-lg shadow-accent/20">
                                            <Edit2 className="h-4 w-4 mr-2" />
                                            Edit
                                        </Button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => {
                                                setIsEditing(false)
                                                setFormData(customer)
                                                setEmailError("")
                                            }}>
                                                Cancel
                                            </Button>
                                            <Button onClick={handleSave} className="shadow-lg shadow-accent/20" disabled={isSaving}>
                                                {isSaving ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save className="h-4 w-4 mr-2" />
                                                        Save
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Customer Name</Label>
                                        <Input
                                            id="name"
                                            value={formData?.name || ""}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contactPerson">Contact Person</Label>
                                        <Input
                                            id="contactPerson"
                                            value={formData?.contactPerson || ""}
                                            onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            Email
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formData?.email || ""}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                            disabled={!isEditing}
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
                                        <Label htmlFor="phone" className="flex items-center gap-2">
                                            <Phone className="h-4 w-4" />
                                            Phone
                                        </Label>
                                        <Input
                                            id="phone"
                                            value={formData?.phone || ""}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="address" className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        Address
                                    </Label>
                                    <Input
                                        id="address"
                                        value={formData?.address || ""}
                                        onChange={(e) => handleInputChange('address', e.target.value)}
                                        disabled={!isEditing}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Associated Items */}
                        <Card className="border-border/50">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Package className="h-5 w-5 text-primary" />
                                            Associated Items
                                        </CardTitle>
                                        <CardDescription>Items linked to this customer</CardDescription>
                                    </div>
                                    <Badge variant="secondary">{customerItems.length} items</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full overflow-x-auto">
                                    {customerItems.length > 0 ? (
                                        <>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="font-semibold whitespace-nowrap">Item Number</TableHead>
                                                        <TableHead className="font-semibold whitespace-nowrap">Name</TableHead>
                                                        <TableHead className="text-right font-semibold whitespace-nowrap">Quantity</TableHead>
                                                        <TableHead className="text-right font-semibold whitespace-nowrap">Unit Price</TableHead>
                                                        <TableHead className="text-right font-semibold whitespace-nowrap">Total Value</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {paginatedItems.map((itemCustomer) => (
                                                        <TableRow key={itemCustomer.id} className="hover:bg-muted/30 transition-colors">
                                                            <TableCell className="font-mono text-sm whitespace-nowrap">{itemCustomer.item.itemNumber}</TableCell>
                                                            <TableCell className="whitespace-nowrap">
                                                                <Link href={`/dashboard/items/${itemCustomer.item.id}`}>
                                                                    <Button variant="link" className="p-0 h-auto font-medium text-primary hover:underline">
                                                                        {itemCustomer.item.name}
                                                                    </Button>
                                                                </Link>
                                                            </TableCell>
                                                            <TableCell className="text-right whitespace-nowrap">{itemCustomer.item.onHand}</TableCell>
                                                            <TableCell className="text-right whitespace-nowrap">${itemCustomer.item.cost?.toFixed(2) || "0.00"}</TableCell>
                                                            <TableCell className="text-right font-medium whitespace-nowrap">
                                                                ${((itemCustomer.item.onHand || 0) * (itemCustomer.item.cost || 0)).toFixed(2)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>

                                            {/* Pagination Controls for Items */}
                                            {customerItems.length > 5 && (
                                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                                                    <div className="text-sm text-muted-foreground">
                                                        Showing {startIndex + 1}-{Math.min(endIndex, customerItems.length)} of {customerItems.length} {customerItems.length === 1 ? 'item' : 'items'}
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
                                    ) : (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p>No items linked to this customer yet</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar - 1 column */}
                    <div className="space-y-6">
                        {/* Quick Stats */}
                        <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
                            <CardHeader>
                                <CardTitle>Quick Stats</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm text-muted-foreground">Status</span>
                                    <Badge variant={customer.status === "ACTIVE" ? "default" : "secondary"}>
                                        {customer.status}
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        Linked Items
                                    </span>
                                    <span className="font-semibold text-2xl">{customerItems.length}</span>
                                </div>

                                <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <DollarSign className="h-4 w-4" />
                                        Total Inventory Value
                                    </span>
                                    <span className="font-semibold text-2xl">
                                        ${customerItems.reduce((sum, ic) =>
                                            sum + ((ic.item.onHand || 0) * (ic.item.cost || 0)), 0
                                        ).toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        Total Units
                                    </span>
                                    <span className="font-semibold">
                                        {customerItems.reduce((sum, ic) => sum + (ic.item.onHand || 0), 0)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Customer Since
                                    </span>
                                    <span className="text-sm">
                                        {new Date(customer.createdAt).toLocaleDateString("en-US", {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Last Updated
                                    </span>
                                    <span className="text-sm">
                                        {new Date(customer.updatedAt).toLocaleDateString("en-US", {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}