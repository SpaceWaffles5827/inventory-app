// Single source of truth for how stock/lot statuses are labelled and coloured in the UI.

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"
export type LotStatus = "ACTIVE" | "DEPLETED" | "EXPIRED" | "QUARANTINED" | "RECALLED"
export type TransactionType = "INPUT" | "OUTPUT" | "TRANSFER"

/** Badge variants defined in components/ui/badge.tsx */
export type StatusVariant = "success" | "warning" | "danger" | "info" | "muted"

export const STOCK_STATUS: Record<StockStatus, { label: string; variant: StatusVariant }> = {
  IN_STOCK: { label: "In stock", variant: "success" },
  LOW_STOCK: { label: "Low stock", variant: "warning" },
  OUT_OF_STOCK: { label: "Out of stock", variant: "danger" },
}

export const LOT_STATUS: Record<LotStatus, { label: string; variant: StatusVariant; description: string }> = {
  ACTIVE: { label: "Active", variant: "success", description: "Available for use" },
  DEPLETED: { label: "Depleted", variant: "muted", description: "No quantity left" },
  EXPIRED: { label: "Expired", variant: "danger", description: "Past its expiration date" },
  QUARANTINED: { label: "Quarantined", variant: "warning", description: "On hold for inspection" },
  RECALLED: { label: "Recalled", variant: "danger", description: "Recalled — do not use" },
}

export const TRANSACTION_TYPE: Record<TransactionType, { label: string; variant: StatusVariant; sign: string }> = {
  INPUT: { label: "Stock in", variant: "success", sign: "+" },
  OUTPUT: { label: "Stock out", variant: "danger", sign: "−" },
  TRANSFER: { label: "Transfer", variant: "info", sign: "" },
}

export function getStockStatus(status?: string | null) {
  return STOCK_STATUS[(status as StockStatus) ?? "IN_STOCK"] ?? STOCK_STATUS.IN_STOCK
}

export function getLotStatus(status?: string | null) {
  return LOT_STATUS[(status as LotStatus) ?? "ACTIVE"] ?? LOT_STATUS.ACTIVE
}

export function getTransactionType(type?: string | null) {
  return TRANSACTION_TYPE[(type as TransactionType) ?? "INPUT"] ?? TRANSACTION_TYPE.INPUT
}

/** Derive a status from on-hand + reorder point when the server didn't send one */
export function deriveStockStatus(onHand: number, reorderPoint = 10): StockStatus {
  if (onHand <= 0) return "OUT_OF_STOCK"
  if (onHand <= reorderPoint) return "LOW_STOCK"
  return "IN_STOCK"
}

/** Human-readable name for a location. Locations have a `code` (e.g. "A-01-03") and optional description. */
export function locationLabel(location?: { code?: string | null; description?: string | null } | null): string {
  if (!location) return "—"
  return location.code || location.description || "Unnamed location"
}
