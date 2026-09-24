"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { MIN_PASSWORD_LENGTH } from "@/components/auth/validation"
import { cn } from "@/lib/utils"

/** Password field with a show/hide toggle. Accepts every <input> prop except `type`. */
export function PasswordInput({ className, disabled, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("h-10 pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

function scorePassword(password: string): number {
  if (password.length < MIN_PASSWORD_LENGTH) return 0
  let score = 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++
  if (password.length >= 12) score++
  return score
}

const LEVELS = [
  { label: "Too short", bar: "bg-destructive", text: "text-destructive" },
  { label: "Weak", bar: "bg-destructive", text: "text-destructive" },
  { label: "Fair", bar: "bg-warning", text: "text-warning-foreground dark:text-warning" },
  { label: "Good", bar: "bg-success", text: "text-success" },
  { label: "Strong", bar: "bg-success", text: "text-success" },
]

/** Live strength meter + minimum-length hint for new passwords */
export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const score = scorePassword(password)
  const level = LEVELS[score]
  const remaining = MIN_PASSWORD_LENGTH - password.length

  let tip = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password && remaining > 0) tip = `${remaining} more character${remaining === 1 ? "" : "s"} needed.`
  else if (password && score < 3) tip = "Mix upper and lower case, numbers or symbols to make it stronger."
  else if (password) tip = "Nice — that's a solid password."

  return (
    <div id={id} className="space-y-1.5">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1 flex-1 rounded-full bg-muted transition-colors",
              password && (score >= segment || (score === 0 && segment === 1)) && level.bar
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {password && <span className={cn("font-medium", level.text)}>{level.label}. </span>}
        {tip}
      </p>
    </div>
  )
}
