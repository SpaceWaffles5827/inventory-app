// Shared validation + redirect helpers for the auth forms.

export const MIN_PASSWORD_LENGTH = 8

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value: string): string | undefined {
  const email = value.trim()
  if (!email) return "Enter your email address"
  if (!EMAIL_RE.test(email)) return "Enter a valid email address, like name@company.com"
  return undefined
}

export function validateNewPassword(value: string): string | undefined {
  if (!value) return "Create a password"
  if (value.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  return undefined
}

export function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) return "Confirm your password"
  if (password !== confirm) return "Passwords do not match"
  return undefined
}

export const DEFAULT_AFTER_LOGIN = "/dashboard"

/**
 * Only follow `next` when it is a same-origin path inside the dashboard, e.g. `/dashboard/items?q=x`.
 * Anything else (absolute URLs, protocol-relative `//host`, backslashes, other paths) falls back to `/dashboard`.
 */
export function getSafeNext(next: string | null | undefined): string {
  if (!next) return DEFAULT_AFTER_LOGIN
  if (!/^\/dashboard(?:[/?#]|$)/.test(next)) return DEFAULT_AFTER_LOGIN
  // eslint-disable-next-line no-control-regex
  if (next.includes("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return DEFAULT_AFTER_LOGIN
  return next
}

/** First key (in display order) that has an error — used to focus it and to give it the shared test id */
export function firstErrorKey<K extends string>(order: readonly K[], errors: Partial<Record<K, string>>): K | undefined {
  return order.find((key) => Boolean(errors[key]))
}

/**
 * Read text fields straight from the form. The auth forms use uncontrolled inputs so anything typed before
 * hydration (or filled by a password manager / test runner) is never lost; the DOM is the source of truth on submit.
 */
export function readFields<K extends string>(form: HTMLFormElement, keys: readonly K[]): Record<K, string> {
  const data = new FormData(form)
  const out = {} as Record<K, string>
  for (const key of keys) {
    const value = data.get(key)
    out[key] = typeof value === "string" ? value : ""
  }
  return out
}

/** Read a single string value from Next's `searchParams` object */
export function paramValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}
