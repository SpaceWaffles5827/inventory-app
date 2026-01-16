"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { createSupplierApi, type SupplierWithCount } from "@/lib/api/suppliers.api"

interface AddSupplierDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    onSuccess: (supplier: SupplierWithCount) => void
}

export function AddSupplierDialog({
    open,
    onOpenChange,
    workspaceId,
    onSuccess,
}: AddSupplierDialogProps) {
    const [formData, setFormData] = useState({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
    })

    const handleCreate = async () => {
        if (!formData.name.trim()) return

        try {
            const response = await createSupplierApi({
                name: formData.name,
                contactPerson: formData.contactPerson || undefined,
                email: formData.email || undefined,
                phone: formData.phone || undefined,
                address: formData.address || undefined,
                workspaceId: workspaceId,
            })

            if (response.data?.supplier) {
                onSuccess(response.data.supplier)
                setFormData({ name: "", contactPerson: "", email: "", phone: "", address: "" })
                onOpenChange(false)
            }
        } catch (error) {
            console.error("Failed to create supplier:", error)
            alert(error instanceof Error ? error.message : "Failed to create supplier")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create New Supplier</DialogTitle>
                    <DialogDescription>Add a new supplier to your inventory management system.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                Supplier Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="e.g., TechSupply Co."
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contactPerson">Contact Person</Label>
                            <Input
                                id="contactPerson"
                                placeholder="e.g., John Smith"
                                value={formData.contactPerson}
                                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="contact@supplier.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                placeholder="+1 (555) 123-4567"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                            id="address"
                            placeholder="Full address including street, city, state, and zip code"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate}>Create Supplier</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}