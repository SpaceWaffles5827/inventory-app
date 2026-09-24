"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormField, TEXT_MAX, fieldA11y, lengthHint } from "@/components/partners/form"
import { createCategoryApi, updateCategoryApi, type CategoryWithCount } from "@/lib/api/categories.api"
import { getErrorMessage } from "@/lib/api/client"

export interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  /** When set the dialog edits this category, otherwise it creates a new one */
  category?: CategoryWithCount | null
  onSuccess: (category: CategoryWithCount) => void
}

export function CategoryFormDialog({ open, onOpenChange, workspaceId, category, onSuccess }: CategoryFormDialogProps) {
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(category)

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" data-testid={isEdit ? "edit-category-dialog" : "add-category-dialog"}>
        {/* Radix unmounts the content while closed, so the form re-initialises on every open */}
        <CategoryForm
          key={category?.id ?? "new"}
          workspaceId={workspaceId}
          category={category ?? null}
          saving={saving}
          setSaving={setSaving}
          onCancel={() => onOpenChange(false)}
          onSaved={(saved) => {
            onSuccess(saved)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

interface Errors {
  name?: string
  description?: string
}

function CategoryForm({
  workspaceId,
  category,
  saving,
  setSaving,
  onCancel,
  onSaved,
}: {
  workspaceId: string
  category: CategoryWithCount | null
  saving: boolean
  setSaving: (saving: boolean) => void
  onCancel: () => void
  onSaved: (category: CategoryWithCount) => void
}) {
  const isEdit = category !== null
  const [name, setName] = useState(category?.name ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [errors, setErrors] = useState<Errors>({})

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // this dialog can be opened from inside another form (Add item) — keep the submit to ourselves
    e.stopPropagation()
    if (saving) return

    const trimmedName = name.trim()
    const trimmedDescription = description.trim()
    if (!trimmedName) {
      setErrors({ name: "Category name is required" })
      return
    }
    setErrors({})
    setSaving(true)
    try {
      if (isEdit) {
        const res = await updateCategoryApi(category.id, {
          name: trimmedName,
          // "" clears the description (the API stores it as null)
          description: trimmedDescription,
          workspaceId,
        })
        const updated = res.data?.category
        if (!updated) throw new Error("The server didn't return the updated category")
        onSaved({
          ...category,
          ...updated,
          // the list endpoint derives itemCount from _count; keep that source of truth
          itemCount: updated._count?.items ?? category.itemCount,
        })
        toast.success("Category updated")
      } else {
        const res = await createCategoryApi({
          name: trimmedName,
          description: trimmedDescription || undefined,
          workspaceId,
        })
        const created = res.data?.category
        if (!created) throw new Error("The server didn't return the new category")
        onSaved({ ...created, itemCount: created._count?.items ?? 0 } as CategoryWithCount)
        toast.success(`Category “${trimmedName}” created`)
      }
    } catch (err) {
      const message = getErrorMessage(err, isEdit ? "Couldn't update category" : "Couldn't create category")
      if (message.toLowerCase().includes("already exists")) setErrors({ name: message })
      else toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Rename this category or update its description."
            : "Group similar items together so they're easier to find and report on."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <FormField id="category-name" label="Name" required error={errors.name}>
          <Input
            {...fieldA11y("category-name", errors.name)}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            placeholder="e.g. Electronics, Packaging"
            maxLength={TEXT_MAX}
            autoComplete="off"
            disabled={saving}
            data-testid="category-name-input"
          />
        </FormField>
        <FormField
          id="category-description"
          label="Description"
          error={errors.description}
          hint={lengthHint(description) ?? "Optional"}
        >
          <Textarea
            {...fieldA11y("category-description", errors.description)}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What belongs in this category?"
            rows={3}
            maxLength={TEXT_MAX}
            disabled={saving}
            data-testid="category-description-input"
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} data-testid="cancel-button-desktop">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="submit-button-desktop">
          {saving && <Loader2 className="animate-spin" />}
          {isEdit ? "Save changes" : "Create category"}
        </Button>
      </DialogFooter>
    </form>
  )
}
