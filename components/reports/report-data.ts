// Normalises the /api/analytics response into one shape the Reports page can render.
//
// Current API (server/controllers/analytics.ts): keyMetrics { totalStockValue, stockTurnover, unitsIn,
// unitsOut, netMovement, unitsTransferred, transactionCount, lowStockCount, outOfStockCount, ... },
// movementData [{ month, label, stockIn, stockOut, net, transfers }], inventoryValueData, categoryDistribution
// [{ name, value (= item count), itemCount, units, inventoryValue }], topMovingItems [{ itemId, name,
// itemNumber, moved (units), transactions, changePct | null, change }], period { granularity, ... }.
// The legacy API sent the same top-level keys with placeholder trends ("+0%", flat months). Every field is
// read defensively so the page degrades gracefully against either version.

export const PERIODS = [
  { value: "30days", label: "Last 30 days", short: "30 days" },
  { value: "3months", label: "Last 90 days", short: "90 days" },
  { value: "6months", label: "Last 6 months", short: "6 months" },
  { value: "1year", label: "Last 12 months", short: "12 months" },
] as const

export type PeriodValue = (typeof PERIODS)[number]["value"]

export interface MovementPoint {
  key: string
  /** Short axis label, e.g. "Sep" */
  label: string
  /** Tooltip label, e.g. "September 2026" */
  fullLabel: string
  in: number
  out: number
  net: number
  /** Units moved between locations (doesn't change on-hand) */
  transfers: number
}

export interface CategoryRow {
  name: string
  /** Inventory value at cost */
  value: number | null
  units: number | null
  items: number | null
}

export interface MoverRow {
  id: string | null
  name: string
  sku: string | null
  unit: string | null
  /** Units moved in the period */
  units: number | null
  /** Number of transactions in the period */
  movements: number | null
  /** % change vs the previous period of the same length; null = unknown */
  changePct: number | null
  /** Didn't move at all in the previous period */
  isNew: boolean
}

export interface LowStockRow {
  id: string
  name: string
  sku: string | null
  unit: string | null
  onHand: number
  reorderPoint: number | null
}

export interface ValuePoint {
  label: string
  fullLabel: string
  value: number
}

export interface ReportData {
  totalValue: number | null
  /** Units shipped ÷ average units on hand over the period */
  turnover: number | null
  transactionCount: number | null
  granularity: "day" | "month" | null
  /** Closing inventory value per bucket (reconstructed by the API) */
  valueTrend: ValuePoint[] | null
  totalUnits: number | null
  totalItems: number | null
  inStock: number | null
  lowStock: number | null
  outOfStock: number | null
  /** null when the API doesn't provide movement history */
  movement: MovementPoint[] | null
  totals: { in: number; out: number; net: number; transfers: number } | null
  categories: CategoryRow[]
  movers: MoverRow[]
  /** false when the API only sends placeholder change values */
  moversHaveChange: boolean
  lowStockItems: LowStockRow[] | null
}

// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickNum(o: Obj, keys: string[]): number | null {
  for (const k of keys) {
    const n = num(o[k])
    if (n !== null) return n
  }
  return null
}

function pickStr(o: Obj, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === "string" && v.trim() !== "") return v
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return null
}

function pickArr(o: Obj, keys: string[]): Obj[] | null {
  for (const k of keys) {
    const v = o[k]
    if (Array.isArray(v)) return v.filter(isObj)
  }
  return null
}

function pickObj(o: Obj, keys: string[]): Obj | null {
  for (const k of keys) {
    const v = o[k]
    if (isObj(v)) return v
  }
  return null
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-09" → Sep / September 2026, "2026-09-14" → Sep 14 / Sep 14, 2026, anything else passes through */
function formatBucket(raw: string, year: string | null): { label: string; fullLabel: string } {
  const month = /^(\d{4})-(\d{2})$/.exec(raw)
  if (month) {
    const d = new Date(Number(month[1]), Number(month[2]) - 1, 1)
    return {
      label: MONTHS[d.getMonth()],
      fullLabel: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    }
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (day) {
    const d = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    return {
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      fullLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    }
  }
  const monthYear = /^([A-Za-z]{3,})\s+(\d{4})$/.exec(raw)
  if (monthYear) return { label: monthYear[1].slice(0, 3), fullLabel: raw }
  return { label: raw, fullLabel: year ? `${raw} ${year}` : raw }
}

/** New API: { month: "Sep", label: "Sep 2026" }; legacy: { month: "Sep" }; also accepts ISO buckets */
function bucketLabels(row: Obj, i: number): { key: string; label: string; fullLabel: string } {
  const short = pickStr(row, ["month", "short"])
  const long = pickStr(row, ["label", "period", "bucket", "date", "key"])
  const raw = long ?? short ?? `#${i + 1}`
  const formatted = formatBucket(raw, pickStr(row, ["year"]))
  // Prefer the API's own short label when the long one is a plain string like "Sep 2026"
  const label = short && short !== raw ? short : formatted.label
  return { key: `${raw}-${i}`, label, fullLabel: formatted.fullLabel }
}

const IN_KEYS = ["in", "stockIn", "inbound", "input", "inQty", "unitsIn", "inQuantity", "received"]
const OUT_KEYS = ["out", "stockOut", "outbound", "output", "outQty", "unitsOut", "outQuantity", "shipped"]

function parseMovement(data: Obj): MovementPoint[] | null {
  const arr =
    pickArr(data, [
      "movementData",
      "stockMovementData",
      "stockMovement",
      "movement",
      "movements",
      "monthlyMovement",
      "monthlyMovements",
      "movementTrend",
      "movementByMonth",
    ]) ??
    // Some versions may fold in/out into the existing trend rows
    (pickArr(data, ["stockTrendData"])?.some((row) => pickNum(row, IN_KEYS) !== null) ? pickArr(data, ["stockTrendData"]) : null)
  if (!arr) return null

  const points: MovementPoint[] = []
  arr.forEach((row, i) => {
    const inQty = pickNum(row, IN_KEYS)
    const outQty = pickNum(row, OUT_KEYS)
    if (inQty === null && outQty === null) return
    const { key, label, fullLabel } = bucketLabels(row, i)
    const i2 = Math.abs(inQty ?? 0)
    const o2 = Math.abs(outQty ?? 0)
    points.push({
      key,
      label,
      fullLabel,
      in: i2,
      out: o2,
      net: pickNum(row, ["net", "netMovement"]) ?? i2 - o2,
      transfers: Math.abs(pickNum(row, ["transfers", "transferred", "unitsTransferred"]) ?? 0),
    })
  })
  return points
}

function parseTotals(data: Obj, km: Obj, movement: MovementPoint[] | null): ReportData["totals"] {
  // New API puts period totals on keyMetrics (unitsIn / unitsOut / netMovement / unitsTransferred)
  for (const t of [pickObj(data, ["movementTotals", "totals", "movementSummary"]), km]) {
    if (!t) continue
    const inQty = pickNum(t, IN_KEYS)
    const outQty = pickNum(t, OUT_KEYS)
    if (inQty !== null || outQty !== null) {
      const i2 = Math.abs(inQty ?? 0)
      const o2 = Math.abs(outQty ?? 0)
      return {
        in: i2,
        out: o2,
        net: pickNum(t, ["net", "netMovement"]) ?? i2 - o2,
        transfers: Math.abs(pickNum(t, ["transfers", "transferred", "unitsTransferred"]) ?? 0),
      }
    }
  }
  if (!movement) return null
  const sum = movement.reduce(
    (acc, p) => ({ in: acc.in + p.in, out: acc.out + p.out, transfers: acc.transfers + p.transfers }),
    { in: 0, out: 0, transfers: 0 }
  )
  return { ...sum, net: sum.in - sum.out }
}

function parseValueTrend(data: Obj, hasRealMovement: boolean): ValuePoint[] | null {
  // The legacy API filled every month with today's value — only trust the series from the new API
  if (!hasRealMovement) return null
  const arr = pickArr(data, ["inventoryValueData", "valueTrend"])
  if (!arr || arr.length < 2) return null
  const points: ValuePoint[] = []
  arr.forEach((row, i) => {
    const value = pickNum(row, ["value", "inventoryValue"])
    if (value === null) return
    const { label, fullLabel } = bucketLabels(row, i)
    points.push({ label, fullLabel, value })
  })
  return points.length >= 2 ? points : null
}

const VALUE_KEYS = ["stockValue", "totalValue", "inventoryValue", "valueAtCost"]
const UNIT_KEYS = ["units", "unitsOnHand", "onHand", "quantity", "totalUnits"]
const ITEM_KEYS = ["items", "itemCount", "skus", "skuCount", "count"]

function parseCategories(data: Obj): CategoryRow[] {
  const breakdown = pickArr(data, [
    "categoryBreakdown",
    "categoryValues",
    "categoryValue",
    "categoriesByValue",
    "valueByCategory",
    "categories",
  ])
  if (breakdown) {
    return breakdown.map((row) => ({
      name: pickStr(row, ["name", "category", "label"]) ?? "Uncategorized",
      value: pickNum(row, [...VALUE_KEYS, "value"]),
      units: pickNum(row, UNIT_KEYS),
      items: pickNum(row, ITEM_KEYS),
    }))
  }
  // Legacy: categoryDistribution = [{ name, value: itemCount }]
  const legacy = pickArr(data, ["categoryDistribution"]) ?? []
  return legacy.map((row) => {
    const value = pickNum(row, VALUE_KEYS)
    const units = pickNum(row, UNIT_KEYS)
    const items = pickNum(row, ITEM_KEYS) ?? (value === null && units === null ? num(row.value) : null)
    return { name: pickStr(row, ["name", "category", "label"]) ?? "Uncategorized", value, units, items }
  })
}

const CHANGE_NUM_KEYS = ["changePercent", "changePct", "percentChange", "pctChange", "changeRate"]

function parseChange(row: Obj): { pct: number | null; numeric: boolean } {
  const n = pickNum(row, CHANGE_NUM_KEYS)
  if (n !== null) return { pct: n, numeric: true }
  if (typeof row.change === "number" && Number.isFinite(row.change)) return { pct: row.change, numeric: true }
  if (typeof row.change === "string") {
    const m = /^\s*([+\-−]?\d+(?:\.\d+)?)\s*%\s*$/.exec(row.change)
    if (m) return { pct: Number(m[1].replace("−", "-")), numeric: false }
  }
  return { pct: null, numeric: false }
}

function parseMovers(data: Obj): { movers: MoverRow[]; haveChange: boolean } {
  const arr = pickArr(data, ["topMovers", "topMovingItems"]) ?? []
  let anyNumeric = false
  let anyNonZero = false
  const movers = arr.map((row) => {
    const movements = pickNum(row, ["transactions", "transactionCount", "movements", "movementCount", "count"])
    // New API: `moved` = units (in + out + transfers) next to `transactions`; legacy: `moved` = transaction count
    const units =
      pickNum(row, ["unitsMoved", "units", "quantity", "totalQuantity", "quantityMoved", "volume"]) ??
      (movements !== null ? num(row.moved) : null)
    const moveCount = movements ?? (units === null ? num(row.moved) : null)
    const { pct, numeric } = parseChange(row)
    if (numeric) anyNumeric = true
    if (pct !== null && pct !== 0) anyNonZero = true
    const previous = pickNum(row, ["previousMoved", "previous", "previousUnits", "previousPeriod", "prevUnits"])
    const isNew =
      pct === null &&
      (row.isNew === true || row.trend === "new" || row.change === "New" || (previous === 0 && (units ?? moveCount ?? 0) > 0))
    return {
      id: pickStr(row, ["itemId", "id"]),
      name: pickStr(row, ["name", "itemName"]) ?? "Unnamed item",
      sku: pickStr(row, ["itemNumber", "sku", "code"]),
      unit: pickStr(row, ["unit"]),
      units,
      movements: moveCount,
      changePct: pct,
      isNew,
    }
  })
  // The legacy endpoint always sent "+0%" — treat an all-zero string column as "no data"
  return { movers, haveChange: anyNumeric || anyNonZero || movers.some((m) => m.isNew) }
}

function parseLowStock(data: Obj): LowStockRow[] | null {
  const arr = pickArr(data, ["lowStockItems", "needsAttention"])
  if (!arr) return null
  return arr.map((row, i) => ({
    id: pickStr(row, ["id", "itemId"]) ?? `row-${i}`,
    name: pickStr(row, ["name", "itemName"]) ?? "Unnamed item",
    sku: pickStr(row, ["itemNumber", "sku"]),
    unit: pickStr(row, ["unit"]),
    onHand: pickNum(row, ["onHand", "quantity", "units"]) ?? 0,
    reorderPoint: pickNum(row, ["reorderPoint", "threshold", "minStock"]),
  }))
}

export function normalizeReport(raw: unknown): ReportData {
  const data = isObj(raw) ? raw : {}
  const km = pickObj(data, ["keyMetrics", "metrics", "summary"]) ?? {}
  const movement = parseMovement(data)
  const { movers, haveChange } = parseMovers(data)
  const period = pickObj(data, ["period"])
  const granularity = period ? pickStr(period, ["granularity"]) : null
  return {
    totalValue: pickNum(km, ["totalStockValue", "inventoryValue", "totalValue"]),
    // Legacy turnover counted every transaction (incl. receipts) — only trust it alongside real movement data
    turnover: movement ? pickNum(km, ["stockTurnover", "turnover"]) : null,
    transactionCount: pickNum(km, ["transactionCount"]),
    granularity: granularity === "day" || granularity === "month" ? granularity : null,
    valueTrend: parseValueTrend(data, movement !== null),
    totalUnits: pickNum(km, ["totalUnits", "unitsOnHand"]),
    totalItems: pickNum(km, ["totalItems", "totalSkus", "itemCount"]),
    inStock: pickNum(km, ["inStockCount"]),
    lowStock: pickNum(km, ["lowStockCount"]) ?? pickNum(data, ["lowStockCount"]),
    outOfStock: pickNum(km, ["outOfStockCount"]) ?? pickNum(data, ["outOfStockCount"]),
    movement,
    totals: parseTotals(data, km, movement),
    categories: parseCategories(data),
    movers,
    moversHaveChange: haveChange,
    lowStockItems: parseLowStock(data),
  }
}
