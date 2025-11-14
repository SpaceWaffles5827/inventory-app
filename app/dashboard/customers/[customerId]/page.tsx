"use client"

import type React from "react"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    ArrowLeft,
    Building2,
    Mail,
    Phone,
    MapPin,
    Calendar,
    DollarSign,
    ShoppingCart,
    FileText,
    Edit,
    Save,
    X,
    Plus,
    Download,
    Send,
    Trash2,
    Loader2,
    Package,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
    getCustomerByIdApi,
    updateCustomerApi,
    deleteCustomerApi,
    detachItemFromCustomerApi,
    type CustomerWithItems,
    type UpdateCustomerRequest,
} from "@/lib/api/customers.api"

interface Transaction {
    id: number
    date: string
    type: "Sale" | "Payment" | "Refund"
    description: string
    amount: number
    status: "Completed" | "Pending" | "Failed"
    invoiceNumber?: string
}

interface Invoice {
    id: number
    invoiceNumber: string
    date: string
    dueDate: string
    amount: number
    status: "Paid" | "Pending" | "Overdue" | "Draft"
    items: InvoiceItem[]
}

interface InvoiceItem {
    id: number
    description: string
    quantity: number
    price: number
}

// Mock functions for transactions and invoices (to be replaced with real API later)
const generateMockTransactions = (customerId: string): Transaction[] => {
    return [
        {
            id: 1,
            date: new Date().toISOString().split("T")[0],
            type: "Sale",
            description: `Product purchase - Order #${customerId.slice(0, 8)}001`,
            amount: 1250.0,
            status: "Completed",
            invoiceNumber: `INV-2024-001`,
        },
    ]
}

const generateMockInvoices = (customerId: string): Invoice[] => {
    return [
        {
            id: 1,
            invoiceNumber: `INV-2024-001`,
            date: new Date().toISOString().split("T")[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            amount: 1250.0,
            status: "Pending",
            items: [{ id: 1, description: "Product Set", quantity: 10, price: 125.0 }],
        },
    ]
}

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
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editedCustomer, setEditedCustomer] = useState<Partial<CustomerWithItems> | null>(null)
    const [isCreateTransactionOpen, setIsCreateTransactionOpen] = useState(false)
    const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
    const [isAddItemOpen, setIsAddItemOpen] = useState(false)
    const [isDetachingItem, setIsDetachingItem] = useState(false)
    const [availableItems, setAvailableItems] = useState<any[]>([])

    // Fetch customer data
    useEffect(() => {
        const workspaceId = localStorage.getItem("currentWorkspaceId")

        if (!workspaceId) {
            toast.error("No workspace selected")
            router.push("/dashboard")
            return
        }

        setCurrentWorkspaceId(workspaceId)

        async function fetchCustomer() {
            try {
                setIsLoading(true)
                console.log('fetching customer by id', customerId, workspaceId)
                const response = await getCustomerByIdApi(customerId, workspaceId!)

                console.log('res', response)

                if (response.status == 'success' && response.data.customer) {
                    const customerData = response.data.customer as CustomerWithItems
                    setCustomer(customerData)
                    setEditedCustomer(customerData)

                    // Load mock transaction/invoice data (replace with real API calls when available)
                    setTransactions(generateMockTransactions(customerId))
                    setInvoices(generateMockInvoices(customerId))
                }
            } catch (error) {
                console.error("Failed to fetch customer:", error)
                toast.error("Failed to load customer details")
                router.push("/dashboard/customers")
            } finally {
                setIsLoading(false)
            }
        }

        fetchCustomer()
    }, [customerId, router])

    // Load available items for linking
    useEffect(() => {
        const loadAvailableItems = async () => {
            if (!currentWorkspaceId) return

            try {
                const response = await fetch(`/api/items?workspaceId=${currentWorkspaceId}`, {
                    credentials: 'include',
                })
                const data = await response.json()

                if (data.status === 'success' && data.data?.items) {
                    setAvailableItems(data.data.items)
                }
            } catch (error) {
                console.error('Failed to load items:', error)
            }
        }

        if (isAddItemOpen) {
            loadAvailableItems()
        }
    }, [isAddItemOpen, currentWorkspaceId])

    const handleDetachItem = async (customerId: string, itemId: string) => {
        if (!confirm('Remove this item from the customer? This action cannot be undone.')) {
            return
        }

        try {
            setIsDetachingItem(true)

            const response = await detachItemFromCustomerApi(customerId, itemId)

            if (response.status === 'success') {
                toast.success('Item removed successfully')
                // Reload customer data
                const customerResponse = await getCustomerByIdApi(customerId, currentWorkspaceId!)
                if (customerResponse.status === 'success' && customerResponse.data.customer) {
                    setCustomer(customerResponse.data.customer as CustomerWithItems)
                }
            } else {
                throw new Error(response.message || 'Failed to remove item')
            }
        } catch (error) {
            console.error('Failed to remove item:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to remove item')
        } finally {
            setIsDetachingItem(false)
        }
    }

    const handleSave = async () => {
        if (!editedCustomer || !customer || !currentWorkspaceId) return

        try {
            setIsSaving(true)

            const updateData: UpdateCustomerRequest = {
                name: editedCustomer.name,
                contactPerson: editedCustomer.contactPerson || undefined,
                email: editedCustomer.email || undefined,
                phone: editedCustomer.phone || undefined,
                address: editedCustomer.address || undefined,
                company: editedCustomer.company || undefined,
                status: editedCustomer.status,
                orderCount: editedCustomer.orderCount,
                totalSpent: editedCustomer.totalSpent,
                workspaceId: currentWorkspaceId,
            }

            const response = await updateCustomerApi(customer.id, updateData)

            if (response.status == 'success' && response.data.customer) {
                setCustomer(response.data.customer as CustomerWithItems)
                setEditedCustomer(response.data.customer as CustomerWithItems)
                setIsEditDialogOpen(false)
                toast.success("Customer updated successfully")
            } else {
                throw new Error(response.message || "Failed to update customer")
            }
        } catch (error) {
            console.error("Failed to update customer:", error)
            toast.error(error instanceof Error ? error.message : "Failed to update customer")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!customer || !currentWorkspaceId) return

        if (!confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
            return
        }

        try {
            setIsDeleting(true)

            const response = await deleteCustomerApi(customer.id, currentWorkspaceId)

            if (response.status === 'success') {
                toast.success("Customer deleted successfully")
                router.push("/dashboard/customers")
            } else {
                throw new Error(response.message || "Failed to delete customer")
            }
        } catch (error) {
            console.error("Failed to delete customer:", error)
            toast.error(error instanceof Error ? error.message : "Failed to delete customer")
        } finally {
            setIsDeleting(false)
        }
    }

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
                        <CardDescription>The customer you're looking for doesn't exist.</CardDescription>
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
            <div className="px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        className="mb-4"
                        onClick={() => router.push("/dashboard/customers")}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Customers
                    </Button>

                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-card-foreground mb-2">{customer.name}</h1>
                            <p className="text-muted-foreground">{customer.company || "No company"}</p>
                        </div>
                        <Button onClick={() => setIsEditDialogOpen(true)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Customer
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                                <ShoppingCart className="h-4 w-4 text-accent" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-card-foreground">{customer.orderCount || 0}</div>
                            <p className="text-xs text-muted-foreground mt-1">Completed orders</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <DollarSign className="h-4 w-4 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-card-foreground">
                                ${(customer.totalSpent || 0).toLocaleString()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Lifetime value</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Linked Items</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                                <FileText className="h-4 w-4 text-accent" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-card-foreground">{customer._count.items}</div>
                            <p className="text-xs text-muted-foreground mt-1">Linked Items</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Customer Since</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Calendar className="h-4 w-4 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-card-foreground">
                                {new Date(customer.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Member duration</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Contact Information Card - Sidebar on larger screens */}
                    <Card className="border-border/50 lg:min-w-96 flex-shrink-0">
                        <CardHeader>
                            <CardTitle>Contact Information</CardTitle>
                            <CardDescription>Primary contact details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Building2 className="h-5 w-5 text-accent" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground mb-1">Contact Person</p>
                                        <p className="font-medium text-card-foreground break-words">
                                            {customer.contactPerson || "Not specified"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Mail className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground mb-1">Email</p>
                                        <p className="font-medium text-card-foreground break-all">
                                            {customer.email || "Not specified"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Phone className="h-5 w-5 text-accent" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground mb-1">Phone</p>
                                        <p className="font-medium text-card-foreground break-words">
                                            {customer.phone || "Not specified"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <MapPin className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground mb-1">Address</p>
                                        <p className="font-medium text-card-foreground break-words leading-relaxed">
                                            {customer.address || "Not specified"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabs Section - Takes remaining width */}
                    <div className="flex-1 min-w-0">
                        <Card className="border-border/50">
                            <CardHeader className="pb-3">
                                <Tabs defaultValue="items" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="items">Items</TabsTrigger>
                                        <TabsTrigger value="transactions">Transactions</TabsTrigger>
                                        <TabsTrigger value="invoices">Invoices</TabsTrigger>
                                    </TabsList>

                                    {/* Items Tab */}
                                    <TabsContent value="items" className="mt-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle>Linked Items</CardTitle>
                                                <CardDescription>Inventory items associated with this customer</CardDescription>
                                            </div>
                                            <Button onClick={() => setIsAddItemOpen(true)}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Link Item
                                            </Button>
                                        </div>

                                        <div className="rounded-lg border border-border/50 overflow-hidden">
                                            {customer.items && customer.items.length > 0 ? (
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/50">
                                                            <TableHead className="font-semibold">Item #</TableHead>
                                                            <TableHead className="font-semibold">Name</TableHead>
                                                            <TableHead className="text-right font-semibold">Stock</TableHead>
                                                            <TableHead className="text-right font-semibold">Cost</TableHead>
                                                            <TableHead className="font-semibold">Last Order</TableHead>
                                                            <TableHead className="font-semibold">Status</TableHead>
                                                            <TableHead className="text-right font-semibold">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {customer.items.map((itemCustomer) => (
                                                            <TableRow key={itemCustomer.id} className="hover:bg-muted/30">
                                                                <TableCell className="font-medium font-mono">{itemCustomer.item.itemNumber}</TableCell>
                                                                <TableCell>{itemCustomer.item.name}</TableCell>
                                                                <TableCell className="text-right">{itemCustomer.item.onHand}</TableCell>
                                                                <TableCell className="text-right">
                                                                    ${itemCustomer.item.cost?.toFixed(2) || "0.00"}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground">
                                                                    {itemCustomer.lastOrderDate
                                                                        ? new Date(itemCustomer.lastOrderDate).toLocaleDateString()
                                                                        : "Never"}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <span
                                                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${itemCustomer.item.status === "IN_STOCK"
                                                                            ? "bg-primary/10 text-primary ring-primary/20"
                                                                            : itemCustomer.item.status === "LOW_STOCK"
                                                                                ? "bg-accent/10 text-accent ring-accent/20"
                                                                                : "bg-muted text-muted-foreground ring-border"
                                                                            }`}
                                                                    >
                                                                        {itemCustomer.item.status}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleDetachItem(itemCustomer.customerId, itemCustomer.itemId)}
                                                                        disabled={isDetachingItem}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            ) : (
                                                <div className="p-8 text-center text-muted-foreground">
                                                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                    <p>No items linked to this customer yet</p>
                                                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsAddItemOpen(true)}>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Link First Item
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* Transactions Tab */}
                                    <TabsContent value="transactions" className="mt-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle>Transaction History</CardTitle>
                                                <CardDescription>All transactions with this customer</CardDescription>
                                            </div>
                                            <Button onClick={() => setIsCreateTransactionOpen(true)}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                New Transaction
                                            </Button>
                                        </div>

                                        <div className="rounded-lg border border-border/50 overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="font-semibold">Date</TableHead>
                                                        <TableHead className="font-semibold">Type</TableHead>
                                                        <TableHead className="font-semibold">Description</TableHead>
                                                        <TableHead className="font-semibold">Invoice</TableHead>
                                                        <TableHead className="text-right font-semibold">Amount</TableHead>
                                                        <TableHead className="text-center font-semibold">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {transactions.map((transaction) => (
                                                        <TableRow key={transaction.id} className="hover:bg-muted/30">
                                                            <TableCell className="text-muted-foreground">{transaction.date}</TableCell>
                                                            <TableCell>
                                                                <span
                                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${transaction.type === "Sale"
                                                                        ? "bg-primary/10 text-primary ring-primary/20"
                                                                        : transaction.type === "Payment"
                                                                            ? "bg-accent/10 text-accent ring-accent/20"
                                                                            : "bg-muted text-muted-foreground ring-border"
                                                                        }`}
                                                                >
                                                                    {transaction.type}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>{transaction.description}</TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {transaction.invoiceNumber || "—"}
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium">${transaction.amount.toFixed(2)}</TableCell>
                                                            <TableCell className="text-center">
                                                                <span
                                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${transaction.status === "Completed"
                                                                        ? "bg-primary/10 text-primary ring-primary/20"
                                                                        : transaction.status === "Pending"
                                                                            ? "bg-accent/10 text-accent ring-accent/20"
                                                                            : "bg-destructive/10 text-destructive ring-destructive/20"
                                                                        }`}
                                                                >
                                                                    {transaction.status}
                                                                </span>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>

                                    {/* Invoices Tab */}
                                    <TabsContent value="invoices" className="mt-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle>Invoices</CardTitle>
                                                <CardDescription>Generate and manage customer invoices</CardDescription>
                                            </div>
                                            <Button onClick={() => setIsCreateInvoiceOpen(true)}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create Invoice
                                            </Button>
                                        </div>

                                        <div className="rounded-lg border border-border/50 overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="font-semibold">Invoice #</TableHead>
                                                        <TableHead className="font-semibold">Date</TableHead>
                                                        <TableHead className="font-semibold">Due Date</TableHead>
                                                        <TableHead className="text-right font-semibold">Amount</TableHead>
                                                        <TableHead className="text-center font-semibold">Status</TableHead>
                                                        <TableHead className="text-right font-semibold">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {invoices.map((invoice) => (
                                                        <TableRow key={invoice.id} className="hover:bg-muted/30">
                                                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                                            <TableCell className="text-muted-foreground">{invoice.date}</TableCell>
                                                            <TableCell className="text-muted-foreground">{invoice.dueDate}</TableCell>
                                                            <TableCell className="text-right font-medium">${invoice.amount.toFixed(2)}</TableCell>
                                                            <TableCell className="text-center">
                                                                <span
                                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${invoice.status === "Paid"
                                                                        ? "bg-primary/10 text-primary ring-primary/20"
                                                                        : invoice.status === "Pending"
                                                                            ? "bg-accent/10 text-accent ring-accent/20"
                                                                            : invoice.status === "Overdue"
                                                                                ? "bg-destructive/10 text-destructive ring-destructive/20"
                                                                                : "bg-muted text-muted-foreground ring-border"
                                                                        }`}
                                                                >
                                                                    {invoice.status}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button variant="ghost" size="sm">
                                                                        <Download className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="sm">
                                                                        <Send className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardHeader>
                        </Card>
                    </div>
                </div>

                {/* Edit Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Customer</DialogTitle>
                            <DialogDescription>Update customer information and contact details</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-name">Customer Name</Label>
                                    <Input
                                        id="edit-name"
                                        value={editedCustomer?.name || ""}
                                        onChange={(e) => setEditedCustomer({ ...editedCustomer!, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-company">Company</Label>
                                    <Input
                                        id="edit-company"
                                        value={editedCustomer?.company || ""}
                                        onChange={(e) => setEditedCustomer({ ...editedCustomer!, company: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-contactPerson">Contact Person</Label>
                                    <Input
                                        id="edit-contactPerson"
                                        value={editedCustomer?.contactPerson || ""}
                                        onChange={(e) => setEditedCustomer({ ...editedCustomer!, contactPerson: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-email">Email</Label>
                                    <Input
                                        id="edit-email"
                                        type="email"
                                        value={editedCustomer?.email || ""}
                                        onChange={(e) => setEditedCustomer({ ...editedCustomer!, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-phone">Phone</Label>
                                    <Input
                                        id="edit-phone"
                                        value={editedCustomer?.phone || ""}
                                        onChange={(e) => setEditedCustomer({ ...editedCustomer!, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-status">Status</Label>
                                    <Select
                                        value={editedCustomer?.status}
                                        onValueChange={(value: "ACTIVE" | "INACTIVE") =>
                                            setEditedCustomer({ ...editedCustomer!, status: value })
                                        }
                                    >
                                        <SelectTrigger id="edit-status">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ACTIVE">Active</SelectItem>
                                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-address">Address</Label>
                                <Textarea
                                    id="edit-address"
                                    value={editedCustomer?.address || ""}
                                    onChange={(e) => setEditedCustomer({ ...editedCustomer!, address: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            <div className="pt-6 border-t">
                                <h4 className="text-sm font-semibold mb-3 text-destructive">Danger Zone</h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Deleting this customer will remove all associated data. This action cannot be undone.
                                </p>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Customer Permanently
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setEditedCustomer(customer)
                                    setIsEditDialogOpen(false)
                                }}
                                disabled={isSaving}
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Create Transaction Dialog */}
                <CreateTransactionDialog
                    open={isCreateTransactionOpen}
                    onOpenChange={setIsCreateTransactionOpen}
                    customerId={customer.id}
                    onTransactionCreated={(transaction) => setTransactions([transaction, ...transactions])}
                />

                {/* Create Invoice Dialog */}
                <CreateInvoiceDialog
                    open={isCreateInvoiceOpen}
                    onOpenChange={setIsCreateInvoiceOpen}
                    customerId={customer.id}
                    customerName={customer.name}
                    onInvoiceCreated={(invoice) => setInvoices([...invoices, invoice])}
                />

                {/* Add Item Dialog */}
                <AddItemDialog
                    open={isAddItemOpen}
                    onOpenChange={setIsAddItemOpen}
                    customerId={customer.id}
                    currentWorkspaceId={currentWorkspaceId!}
                    availableItems={availableItems}
                    onItemAdded={async () => {
                        // Reload customer data
                        const response = await getCustomerByIdApi(customer.id, currentWorkspaceId!)
                        if (response.status === 'success' && response.data.customer) {
                            setCustomer(response.data.customer as CustomerWithItems)
                        }
                    }}
                />
            </div>
        </div>
    )
}

function CreateTransactionDialog({
    open,
    onOpenChange,
    customerId,
    onTransactionCreated,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    onTransactionCreated: (transaction: Transaction) => void
}) {
    const [formData, setFormData] = useState({
        type: "Sale" as "Sale" | "Payment" | "Refund",
        description: "",
        amount: "",
        status: "Completed" as "Completed" | "Pending" | "Failed",
        date: new Date().toISOString().split("T")[0],
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const newTransaction: Transaction = {
            id: Date.now(),
            date: formData.date,
            type: formData.type,
            description: formData.description,
            amount: Number.parseFloat(formData.amount),
            status: formData.status,
        }
        onTransactionCreated(newTransaction)
        console.log("Creating transaction:", newTransaction, "for customer:", customerId)
        onOpenChange(false)
        // Reset form
        setFormData({
            type: "Sale",
            description: "",
            amount: "",
            status: "Completed",
            date: new Date().toISOString().split("T")[0],
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New Transaction</DialogTitle>
                    <DialogDescription>Record a new transaction for this customer</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="type">Transaction Type</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(value: "Sale" | "Payment" | "Refund") => setFormData({ ...formData, type: value })}
                        >
                            <SelectTrigger id="type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Sale">Sale</SelectItem>
                                <SelectItem value="Payment">Payment</SelectItem>
                                <SelectItem value="Refund">Refund</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Enter transaction description"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount ($)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0.00"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value: "Completed" | "Pending" | "Failed") => setFormData({ ...formData, status: value })}
                        >
                            <SelectTrigger id="status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Completed">Completed</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Failed">Failed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create Transaction</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function CreateInvoiceDialog({
    open,
    onOpenChange,
    customerId,
    customerName,
    onInvoiceCreated,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    customerName: string
    onInvoiceCreated: (invoice: Invoice) => void
}) {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "Draft" as "Paid" | "Pending" | "Overdue" | "Draft",
    })

    const [items, setItems] = useState<InvoiceItem[]>([{ id: 1, description: "", quantity: 1, price: 0 }])

    const addItem = () => {
        setItems([...items, { id: items.length + 1, description: "", quantity: 1, price: 0 }])
    }

    const updateItem = (id: number, field: keyof InvoiceItem, value: string | number) => {
        setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
    }

    const removeItem = (id: number) => {
        if (items.length > 1) {
            setItems(items.filter((item) => item.id !== id))
        }
    }

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + item.quantity * item.price, 0)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const newInvoice: Invoice = {
            id: Date.now(),
            invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)
                .toString()
                .padStart(3, "0")}`,
            date: formData.date,
            dueDate: formData.dueDate,
            amount: calculateTotal(),
            status: formData.status,
            items: items,
        }
        onInvoiceCreated(newInvoice)
        console.log("Creating invoice:", newInvoice, "for customer:", customerId)
        onOpenChange(false)
        // Reset form
        setFormData({
            date: new Date().toISOString().split("T")[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            status: "Draft",
        })
        setItems([{ id: 1, description: "", quantity: 1, price: 0 }])
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Invoice</DialogTitle>
                    <DialogDescription>Generate an invoice for {customerName}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Invoice Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="invoiceStatus">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value: "Paid" | "Pending" | "Overdue" | "Draft") =>
                                    setFormData({ ...formData, status: value })
                                }
                            >
                                <SelectTrigger id="invoiceStatus">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Draft">Draft</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Paid">Paid</SelectItem>
                                    <SelectItem value="Overdue">Overdue</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Line Items</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Item
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
                                    <div className="col-span-6">
                                        <Input
                                            placeholder="Item description"
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            min="1"
                                            placeholder="Qty"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, "quantity", Number.parseInt(e.target.value) || 1)}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="Price"
                                            value={item.price}
                                            onChange={(e) => updateItem(item.id, "price", Number.parseFloat(e.target.value) || 0)}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-center justify-center">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeItem(item.id)}
                                            disabled={items.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                                <p className="text-2xl font-bold">${calculateTotal().toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create Invoice</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function AddItemDialog({
    open,
    onOpenChange,
    customerId,
    currentWorkspaceId,
    availableItems,
    onItemAdded,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    currentWorkspaceId: string
    availableItems: any[]
    onItemAdded: () => void
}) {
    const [selectedItemId, setSelectedItemId] = useState<string>("")
    const [notes, setNotes] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const selectedItem = availableItems.find((item) => item.id === selectedItemId)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedItem) return

        try {
            setIsSubmitting(true)

            const response = await fetch('/api/customers/attach-item', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId,
                    itemId: selectedItemId,
                    quantity: 0,
                    notes: notes || undefined,
                }),
            })

            const result = await response.json()

            if (response.ok) {
                toast.success('Item linked successfully')
                onItemAdded()
                onOpenChange(false)

                // Reset form
                setSelectedItemId("")
                setNotes("")
            } else {
                throw new Error(result.message || 'Failed to link item')
            }
        } catch (error) {
            console.error('Failed to link item:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to link item')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Link Item to Customer</DialogTitle>
                    <DialogDescription>Attach an inventory item to this customer</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="item">Select Item</Label>
                        <Select value={selectedItemId} onValueChange={setSelectedItemId} required>
                            <SelectTrigger id="item">
                                <SelectValue placeholder="Choose an item from inventory" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableItems.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        <div className="flex items-center justify-between w-full">
                                            <span>{item.name}</span>
                                            <span className="text-xs text-muted-foreground ml-2">({item.itemNumber})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedItem && (
                        <div className="rounded-lg border border-border/50 p-4 bg-muted/30">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Category</p>
                                    <p className="font-medium">{selectedItem.category?.name || 'Uncategorized'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Current Stock</p>
                                    <p className="font-medium">{selectedItem.onHand} units</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Item Number</p>
                                    <p className="font-medium font-mono">{selectedItem.itemNumber}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Cost</p>
                                    <p className="font-medium">${selectedItem.cost?.toFixed(2) || '0.00'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any notes about this item..."
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!selectedItemId || isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Linking...
                                </>
                            ) : (
                                <>
                                    <Package className="h-4 w-4 mr-2" />
                                    Link Item
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}