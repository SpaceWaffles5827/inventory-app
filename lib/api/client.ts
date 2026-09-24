// Shared fetch wrapper used by every lib/api/*.api.ts module.
// - always sends the session cookie
// - tolerates non-JSON responses (e.g. a 502 HTML page from the proxy)
// - normalises error messages from `{ message }` or `{ error }` bodies
// - redirects to /login when the session has expired (except on auth pages/endpoints)

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface ApiRequestOptions {
  method?: Method
  /** JSON-serialisable body, or FormData for uploads */
  body?: unknown
  /** Query params; undefined/null/"" values are skipped */
  query?: Record<string, string | number | boolean | undefined | null>
  /** Used when the server does not supply a message */
  errorMessage?: string
  /** Set false to stop the automatic redirect to /login on 401 */
  redirectOnUnauthorized?: boolean
  signal?: AbortSignal
}

const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/accept-invitation"]

let redirecting = false

function handleUnauthorized() {
  if (typeof window === "undefined" || redirecting) return
  const path = window.location.pathname
  if (!path.startsWith("/dashboard")) return
  if (AUTH_PATHS.some((p) => path.startsWith(p))) return
  redirecting = true
  const next = encodeURIComponent(path + window.location.search)
  // Hard navigation: this runs outside React (no router available) and must reset client state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${next}`)
}

export function buildQuery(query?: ApiRequestOptions["query"]): string {
  if (!query) return ""
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, errorMessage = "Something went wrong", redirectOnUnauthorized = true, signal } = options

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData
  const headers: Record<string, string> = { Accept: "application/json" }
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json"

  let response: Response
  try {
    response = await fetch(`${path}${buildQuery(query)}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0)
  }

  const text = await response.text()
  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = undefined
    }
  }

  if (!response.ok) {
    if (response.status === 401 && redirectOnUnauthorized) handleUnauthorized()
    const obj = (data ?? {}) as { message?: unknown; error?: unknown }
    const message =
      (typeof obj.message === "string" && obj.message) ||
      (typeof obj.error === "string" && obj.error) ||
      (response.status >= 500 ? "The server hit an error. Please try again." : errorMessage)
    throw new ApiError(message, response.status, data)
  }

  return data as T
}

/** Turn any thrown value into a user-facing message */
export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "string") return err
  return fallback
}
