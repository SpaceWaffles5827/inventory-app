// Matching scanned codes to items and locations.

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

/** Numeric codes compare without leading zeros, so UPC-A (12) / EAN-13 (13) / GTIN-14 variants match */
function numericCore(value: string): string | null {
  return /^\d+$/.test(value) ? value.replace(/^0+/, "") || "0" : null
}

function sameCode(a: string | null | undefined, b: string): boolean {
  const left = normalize(a)
  if (!left) return false
  if (left === b) return true
  const lc = numericCore(left)
  const rc = numericCore(b)
  return lc !== null && rc !== null && lc === rc
}

/** Item whose barcode (or, failing that, item number) matches the scanned code */
export function findItemByCode<T extends { barcode?: string | null; itemNumber?: string | null }>(
  items: T[],
  raw: string
): T | null {
  const code = normalize(raw)
  if (!code) return null
  return (
    items.find((i) => sameCode(i.barcode, code)) ??
    items.find((i) => normalize(i.itemNumber) === code) ??
    null
  )
}

/** Location whose barcode or code matches the scanned code */
export function findLocationByCode<T extends { barcode?: string | null; code?: string | null }>(
  locations: T[],
  raw: string
): T | null {
  const code = normalize(raw)
  if (!code) return null
  return (
    locations.find((l) => sameCode(l.barcode, code)) ??
    locations.find((l) => normalize(l.code) === code) ??
    null
  )
}
