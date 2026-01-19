"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { AlertCircle } from "lucide-react"

interface AddCustomerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    onSuccess: () => void
}

export function AddCustomerDialog({
    open,
    onOpenChange,
    workspaceId,
    onSuccess,
}: AddCustomerDialogProps) {
    const [formData, setFormData] = useState({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [emailError, setEmailError] = useState("")

    const validateEmail = (email: string): boolean => {
        if (!email.trim()) return true
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email.trim())
    }

    const handleInputChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        if (field === "email") {
            setEmailError("")
        }
    }

    const handleStatusChange = (value: "ACTIVE" | "INACTIVE") => {
        setFormData(prev => ({ ...prev, status: value }))
    }

    const handleSubmit = async () => {
        setEmailError("")

        if (!formData.name.trim()) {
            return
        }

        if (formData.email.trim() && !validateEmail(formData.email)) {
            setEmailError("Please enter a valid email address")
            return
        }

        setIsSubmitting(true)

        try {
            const { createCustomerApi } = await import("@/lib/api/customers.api")
            const response = await createCustomerApi({
                name: formData.name.trim(),
                contactPerson: formData.contactPerson.trim() || undefined,
                email: formData.email.trim() || undefined,
                phone: formData.phone.trim() || undefined,
                address: formData.address.trim() || undefined,
                status: formData.status,
                workspaceId: workspaceId,
            })

            if (response.status === "success") {
                const { toast } = await import("sonner")
                toast.success("Customer created successfully")
                resetForm()
                onSuccess()
            }
        } catch (error) {
            const { toast } = await import("sonner")
            toast.error("Failed to create customer", {
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            })
        } finally {
            setIsSubmitting(false)
        }
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

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            resetForm()
        }
        onOpenChange(newOpen)
    }

    const isFormValid = formData.name.trim()

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                enableKeyboardAvoidance={true}
                hideClose={true}
                className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
            >
                {/* Header */}
                <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                    {/* Mobile Header with Actions */}
                    <div className="flex items-center justify-between gap-2 sm:hidden relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenChange(false)}
                            disabled={isSubmitting}
                            className="h-9"
                        >
                            Cancel
                        </Button>
                        <DialogTitle className="text-base font-semibold absolute left-1/2 -translate-x-1/2">Add Customer</DialogTitle>
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={!isFormValid || isSubmitting}
                            className="h-9"
                        >
                            {isSubmitting ? "Adding..." : "Add"}
                        </Button>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden sm:block">
                        <DialogTitle>Create New Customer</DialogTitle>
                        <DialogDescription className="mt-1.5">
                            Add a new customer to your inventory management system.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* Scrollable Form Content */}
                <div
                    className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">
                                    Customer Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Acme Corporation"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactPerson">Contact Person</Label>
                                <Input
                                    id="contactPerson"
                                    placeholder="e.g., John Smith"
                                    value={formData.contactPerson}
                                    onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="contact@customer.com"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className={emailError ? "border-destructive" : ""}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    inputMode="email"
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
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    inputMode="tel"
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
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
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
                </div>

                {/* Footer - Desktop Only */}
                <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!isFormValid || isSubmitting}
                    >
                        {isSubmitting ? "Creating..." : "Create Customer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}