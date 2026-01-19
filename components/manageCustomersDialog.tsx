"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Users, Building2, Plus, Trash2, Save, Loader2 } from "lucide-react"
import { updateItemApi } from "@/lib/api/items.api"
import { getItemByIdApi, type ItemWithDetails } from "@/lib/api/items.api"
import { type CustomerWithCount } from "@/lib/api/customers.api"
import { toast } from "sonner"

interface ManageCustomersDialogProps {
    isOpen: boolean
    onClose: () => void
    itemId: string
    currentCustomerIds: string[]
    customers: CustomerWithCount[]
    onSuccess: (updatedItem: ItemWithDetails) => void
}

export function ManageCustomersDialog({
    isOpen,
    onClose,
    itemId,
    currentCustomerIds,
    customers,
    onSuccess,
}: ManageCustomersDialogProps) {
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(currentCustomerIds)
    const [newCustomerId, setNewCustomerId] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    // Update state when dialog opens with new customer IDs
    useState(() => {
        if (isOpen) {
            setSelectedCustomerIds(currentCustomerIds)
            setNewCustomerId("")
        }
    })

    const handleAddCustomer = () => {
        if (newCustomerId && !selectedCustomerIds.includes(newCustomerId)) {
            setSelectedCustomerIds([...selectedCustomerIds, newCustomerId])
            setNewCustomerId("")
        }
    }

    const handleRemoveCustomer = (customerId: string) => {
        setSelectedCustomerIds(selectedCustomerIds.filter((id) => id !== customerId))
    }

    const handleUpdateCustomers = async () => {
        setIsSaving(true)
        try {
            const updateData = {
                customerIds: selectedCustomerIds,
            }

            const response = await updateItemApi(itemId, updateData)

            if (response.data?.item) {
                // Reload the full item data with all relationships including transactions
                const refreshResponse = await getItemByIdApi(itemId)
                if (refreshResponse.data?.item) {
                    onSuccess(refreshResponse.data.item as ItemWithDetails)
                }
                onClose()
                toast.success("Customers updated successfully!")
            }
        } catch (error) {
            console.error("Failed to update customers:", error)
            toast.error(error instanceof Error ? error.message : "Failed to update customers")
        } finally {
            setIsSaving(false)
        }
    }

    const selectedCustomers = customers.filter((c) => selectedCustomerIds.includes(c.id))

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary" />
                        </div>
                        Manage Customers
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Link this item to specific customers. Multiple customers can be assigned to track custom orders or
                        dedicated inventory.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Assigned Customers ({selectedCustomerIds.length})</Label>
                        {selectedCustomerIds.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                                No customers assigned yet
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {selectedCustomers.map((customer) => (
                                    <div
                                        key={customer.id}
                                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/30"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            <div>
                                                <span className="font-medium text-sm">{customer.name}</span>
                                                {customer.company && (
                                                    <p className="text-xs text-muted-foreground">{customer.company}</p>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleRemoveCustomer(customer.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="addCustomer" className="text-xs font-medium">
                            Add Customer
                        </Label>
                        <div className="flex gap-2">
                            <Select value={newCustomerId} onValueChange={(value) => setNewCustomerId(value)}>
                                <SelectTrigger id="addCustomer" className="flex-1 h-8">
                                    <SelectValue placeholder="Select a customer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers
                                        .filter((c) => !selectedCustomerIds.includes(c.id))
                                        .map((customer) => (
                                            <SelectItem key={customer.id} value={customer.id}>
                                                <div>
                                                    <div className="text-sm">{customer.name}</div>
                                                    {customer.company && (
                                                        <div className="text-xs text-muted-foreground">{customer.company}</div>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleAddCustomer} disabled={!newCustomerId} size="sm" className="h-8">
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Select from existing customers or create new ones in the Customers page
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSaving}
                        size="sm"
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleUpdateCustomers} disabled={isSaving} size="sm">
                        {isSaving ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}