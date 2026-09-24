"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { fieldDescriptionId } from "./form-field"

export interface ComboboxOption {
  value: string
  label: string
  testId?: string
}

interface EntityComboboxProps {
  id: string
  /** Selected option value, "" for none */
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  /** Adds a "Create new…" entry that is always visible */
  createLabel?: string
  onCreate?: () => void
  createTestId?: string
  /** Adds a "Clear selection" entry when something is selected */
  clearable?: boolean
  disabled?: boolean
  invalid?: boolean
  /** Render labels in a monospace font (location codes) */
  mono?: boolean
  triggerTestId?: string
  searchTestId?: string
}

/** Searchable single-select (category / supplier / location pickers) with an optional "create new" action */
export function EntityCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  createLabel,
  onCreate,
  createTestId,
  clearable = false,
  disabled = false,
  invalid = false,
  mono = false,
  triggerTestId,
  searchTestId,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={fieldDescriptionId(id)}
          disabled={disabled}
          className="w-full justify-between px-3 font-normal"
          data-testid={triggerTestId}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground", selected && mono && "font-mono")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} data-testid={searchTestId} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    data-testid={option.testId}
                  >
                    <Check className={cn("size-4", option.value === value ? "opacity-100" : "opacity-0")} />
                    <span className={cn("truncate", mono && "font-mono")}>{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {(onCreate || (clearable && selected)) && (
              <>
                <CommandSeparator alwaysRender />
                <CommandGroup forceMount>
                  {clearable && selected && (
                    <CommandItem
                      forceMount
                      value="__clear__"
                      onSelect={() => {
                        onChange("")
                        setOpen(false)
                      }}
                    >
                      <X className="size-4" />
                      Clear selection
                    </CommandItem>
                  )}
                  {onCreate && (
                    <CommandItem
                      forceMount
                      value="__create__"
                      onSelect={() => {
                        setOpen(false)
                        onCreate()
                      }}
                      className="text-primary data-[selected=true]:text-primary"
                      data-testid={createTestId}
                    >
                      <Plus className="size-4 text-primary" />
                      {createLabel ?? "Create new"}
                    </CommandItem>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
