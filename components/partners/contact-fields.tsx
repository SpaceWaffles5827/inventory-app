"use client"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { FormField, TEXT_MAX, fieldA11y, isValidEmail, isValidPhone, lengthHint } from "@/components/partners/form"

export interface ContactValues {
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
}

export type ContactErrors = Partial<Record<keyof ContactValues, string>>

type ContactSource = {
  name?: string | null
  contactPerson?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

export function contactValuesFrom(source?: ContactSource | null): ContactValues {
  return {
    name: source?.name ?? "",
    contactPerson: source?.contactPerson ?? "",
    email: source?.email ?? "",
    phone: source?.phone ?? "",
    address: source?.address ?? "",
  }
}

/** Trimmed payload. Empty optional fields become "" so edits can clear them (the API stores "" as null). */
export function trimContact(values: ContactValues) {
  return {
    name: values.name.trim(),
    contactPerson: values.contactPerson.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    address: values.address.trim(),
  }
}

export function validateContact(values: ContactValues, noun: string): ContactErrors {
  const errors: ContactErrors = {}
  if (!values.name.trim()) errors.name = `${noun} name is required`
  if (values.email.trim() && !isValidEmail(values.email)) errors.email = "Enter a valid email, e.g. orders@company.com"
  if (values.phone.trim() && !isValidPhone(values.phone)) errors.phone = "Enter a valid phone number (7–15 digits)"
  return errors
}

/** Map a server error onto a field when we can tell which one it's about */
export function serverFieldError(message: string): ContactErrors | null {
  const m = message.toLowerCase()
  if (m.includes("already exists")) return { name: message }
  if (m.includes("email")) return { email: message }
  return null
}

interface ContactFieldsProps {
  idPrefix: string
  noun: string
  values: ContactValues
  errors: ContactErrors
  onChange: (field: keyof ContactValues, value: string) => void
  disabled?: boolean
  namePlaceholder?: string
  emailPlaceholder?: string
  /** Extra full-width field(s) rendered right after the name */
  afterName?: React.ReactNode
}

export function ContactFields({
  idPrefix,
  noun,
  values,
  errors,
  onChange,
  disabled,
  namePlaceholder,
  emailPlaceholder = "orders@company.com",
  afterName,
}: ContactFieldsProps) {
  const id = (field: keyof ContactValues) => `${idPrefix}-${field}`

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id={id("name")} label={`${noun} name`} required error={errors.name} className="sm:col-span-2">
        <Input
          {...fieldA11y(id("name"), errors.name)}
          value={values.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder={namePlaceholder}
          maxLength={TEXT_MAX}
          autoComplete="off"
          disabled={disabled}
          data-testid={`${idPrefix}-name-input`}
        />
      </FormField>

      {afterName && <div className="sm:col-span-2">{afterName}</div>}

      <FormField id={id("contactPerson")} label="Contact person" error={errors.contactPerson}>
        <Input
          {...fieldA11y(id("contactPerson"), errors.contactPerson)}
          value={values.contactPerson}
          onChange={(e) => onChange("contactPerson", e.target.value)}
          placeholder="e.g. Jane Smith"
          maxLength={TEXT_MAX}
          autoComplete="off"
          disabled={disabled}
        />
      </FormField>

      <FormField id={id("phone")} label="Phone" error={errors.phone}>
        <Input
          {...fieldA11y(id("phone"), errors.phone)}
          type="tel"
          inputMode="tel"
          value={values.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder="+1 555 123 4567"
          maxLength={50}
          autoComplete="off"
          disabled={disabled}
        />
      </FormField>

      <FormField id={id("email")} label="Email" error={errors.email} className="sm:col-span-2">
        <Input
          {...fieldA11y(id("email"), errors.email)}
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder={emailPlaceholder}
          maxLength={TEXT_MAX}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={disabled}
        />
      </FormField>

      <FormField
        id={id("address")}
        label="Address"
        error={errors.address}
        hint={lengthHint(values.address)}
        className="sm:col-span-2"
      >
        <Textarea
          {...fieldA11y(id("address"), errors.address)}
          value={values.address}
          onChange={(e) => onChange("address", e.target.value)}
          placeholder="Street, city, postcode, country"
          rows={2}
          maxLength={TEXT_MAX}
          disabled={disabled}
        />
      </FormField>
    </div>
  )
}

/** "Active" toggle row shared by the supplier and customer forms */
export function ActiveField({
  id,
  checked,
  onCheckedChange,
  description,
  disabled,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  description: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 p-3">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          Active
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}
