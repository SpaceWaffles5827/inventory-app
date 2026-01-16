"use client"

import { useState, useEffect } from "react"
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
import { updateSupplierApi, type SupplierWithCount } from "@/lib/api/suppliers.api"

interface EditSupplierDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    supplier: SupplierWithCount | null
    onSuccess: (supplier: SupplierWithCount) => void
}

export function EditSupplierDialog({
    open,
    onOpenChange,
    workspaceId,
    supplier,
    onSuccess,
}: EditSupplierDialogProps) {
    const [formData, setFormData] = useState({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
    })

    // Update form data when supplier changes
    useEffect(() => {
        if (supplier) {
            setFormData({
                name: supplier.name,
                contactPerson: supplier.contactPerson || "",
                email: supplier.email || "",
                phone: supplier.phone || "",
                address: supplier.address || "",
            })
        }
    }, [supplier])

    const handleEdit = async () => {
        if (!supplier || !formData.name.trim()) return

        try {
            const response = await updateSupplierApi(supplier.id, {
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
            console.error("Failed to update supplier:", error)
            alert(error instanceof Error ? error.message : "Failed to update supplier")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit Supplier</DialogTitle>
                    <DialogDescription>Update supplier information and contact details.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">
                                Supplier Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit-name"
                                placeholder="e.g., TechSupply Co."
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-contactPerson">Contact Person</Label>
                            <Input
                                id="edit-contactPerson"
                                placeholder="e.g., John Smith"
                                value={formData.contactPerson}
                                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                placeholder="contact@supplier.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-phone">Phone</Label>
                            <Input
                                id="edit-phone"
                                placeholder="+1 (555) 123-4567"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-address">Address</Label>
                        <Textarea
                            id="edit-address"
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
                    <Button onClick={handleEdit}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}