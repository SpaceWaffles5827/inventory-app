"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Trash2, Plus, Users, Building2 } from "lucide-react"
import type { CustomerWithCount } from "@/lib/api/customers.api"

interface ManageCustomersDialogProps {
    isOpen: boolean
    onClose: () => void
    customers: CustomerWithCount[]
    currentCustomerIds: string[]
    onUpdate: (customerIds: string[]) => Promise<void>
    isSaving: boolean
}

export function ManageCustomersDialog({
    isOpen,
    onClose,
    customers,
    currentCustomerIds,
    onUpdate,
    isSaving
}: ManageCustomersDialogProps) {
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(currentCustomerIds)
    const [newCustomerId, setNewCustomerId] = useState("")

    useEffect(() => {
        if (isOpen) {
            setSelectedCustomerIds(currentCustomerIds)
            setNewCustomerId("")
        }
    }, [isOpen, currentCustomerIds])

    const handleAddCustomer = () => {
        if (newCustomerId && !selectedCustomerIds.includes(newCustomerId)) {
            const updatedIds = [...selectedCustomerIds, newCustomerId]
            setSelectedCustomerIds(updatedIds)
            setNewCustomerId("")
        }
    }

    const handleRemoveCustomer = (customerId: string) => {
        const updatedIds = selectedCustomerIds.filter((id) => id !== customerId)
        setSelectedCustomerIds(updatedIds)
    }

    const handleSubmit = async () => {
        await onUpdate(selectedCustomerIds)
    }

    const selectedCustomers = customers.filter(c => selectedCustomerIds.includes(c.id))

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
                    <Button onClick={handleSubmit} disabled={isSaving} size="sm">
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