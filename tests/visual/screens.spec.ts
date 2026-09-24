/**
 * Visual QA sweep: seeds a demo workspace through the API, then screenshots every page
 * at desktop + mobile widths in light + dark mode, and records console errors per page.
 *
 *   npx dotenv -e .test.env --expand -- npx playwright test --project=visual
 *
 * Output: test-results/screens/*.png and test-results/screens/report.json
 */
import { test, expect, type APIRequestContext, type Page } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const OUT = path.join("test-results", "screens")
const PASSWORD = "Visual-Test-1234!"

type Ctx = { workspaceId: string; itemId?: string; locationId?: string; categoryId?: string; customerId?: string }

async function api<T = unknown>(request: APIRequestContext, method: string, url: string, data?: unknown): Promise<T> {
  const res = await request.fetch(url, { method, data })
  const body = await res.json().catch(() => ({}))
  if (!res.ok()) throw new Error(`${method} ${url} → ${res.status()}: ${JSON.stringify(body)}`)
  return body as T
}

async function seed(page: Page): Promise<Ctx> {
  const email = `visual+${Date.now()}@example.com`
  const r = page.request
  await api(r, "POST", "/api/auth/register", { firstName: "Avery", lastName: "Quinn", email, password: PASSWORD })
  await api(r, "POST", "/api/auth/login", { email, password: PASSWORD })

  const ws = await api<{ data: { workspaces: { id: string }[] } }>(r, "GET", "/api/workspaces")
  const workspaceId = ws.data.workspaces[0].id

  await api(r, "PUT", "/api/locations/workspace-structure", {
    workspaceId,
    structure: { levels: [{ label: "Zone" }, { label: "Aisle" }, { label: "Shelf" }] },
  }).catch(() => undefined)

  const locationIds: string[] = []
  for (const [zone, aisle, shelf, description] of [
    ["A", "01", "01", "Receiving dock"],
    ["A", "01", "02", "Fast movers"],
    ["B", "02", "01", "Bulk storage"],
    ["C", "01", "03", "Returns"],
  ]) {
    const res = await api<{ data: { location: { id: string } } }>(r, "POST", "/api/locations", {
      workspaceId,
      code: `${zone}-${aisle}-${shelf}`,
      description,
      capacity: 500,
      structure: [
        { label: "Zone", value: zone },
        { label: "Aisle", value: aisle },
        { label: "Shelf", value: shelf },
      ],
    })
    locationIds.push(res.data.location.id)
  }

  const categoryIds: string[] = []
  for (const [name, description] of [
    ["Fasteners", "Screws, bolts and anchors"],
    ["Electrical", "Cables, connectors and switches"],
    ["Packaging", "Boxes, tape and void fill"],
  ]) {
    const res = await api<{ data: { category: { id: string } } }>(r, "POST", "/api/categories", { workspaceId, name, description })
    categoryIds.push(res.data.category.id)
  }

  const supplier = await api<{ data: { supplier: { id: string } } }>(r, "POST", "/api/suppliers", {
    workspaceId,
    name: "Northwind Industrial",
    contactPerson: "Sam Lee",
    email: "orders@northwind.example",
    phone: "+1 555 0100",
    isActive: true,
  })
  const customer = await api<{ data: { customer: { id: string } } }>(r, "POST", "/api/customers", {
    workspaceId,
    name: "Harbor Builders",
    company: "Harbor Builders LLC",
    email: "purchasing@harbor.example",
    status: "ACTIVE",
  })

  const items: { id: string }[] = []
  const catalog: [string, string, number, number, number, number][] = [
    // name, unit, cost, category idx, location idx, qty
    ["M6 x 20 hex bolt", "pcs", 0.12, 0, 0, 1200],
    ["Wall anchor 8mm", "pcs", 0.08, 0, 1, 40],
    ["Cat6 patch cable 2m", "pcs", 3.5, 1, 1, 85],
    ["Rocker switch 16A", "pcs", 1.9, 1, 2, 0],
    ["Shipping box 30x20x15", "box", 0.95, 2, 2, 320],
    ["Packing tape 48mm", "roll", 2.4, 2, 3, 6],
  ]
  for (const [name, unit, cost, cat, loc, qty] of catalog) {
    const res = await api<{ data: { item: { id: string } } }>(r, "POST", "/api/items", {
      workspaceId,
      name,
      unit,
      cost,
      categoryId: categoryIds[cat],
      supplierId: supplier.data.supplier.id,
      locationIds: [locationIds[loc]],
      reorderPoint: 50,
    })
    const id = res.data.item.id
    items.push({ id })
    if (qty > 0) {
      await api(r, "POST", `/api/items/${id}/adjust-stock`, {
        type: "INPUT",
        quantity: qty,
        reason: "Received",
        locationId: locationIds[loc],
      })
    }
  }
  // some movement history
  await api(r, "POST", `/api/items/${items[0].id}/adjust-stock`, {
    type: "OUTPUT",
    quantity: 150,
    reason: "Sold",
    locationId: locationIds[0],
  }).catch(() => undefined)
  await api(r, "POST", `/api/items/${items[4].id}/transfer-stock`, {
    fromLocationId: locationIds[2],
    toLocationId: locationIds[3],
    quantity: 40,
  }).catch(() => undefined)

  return {
    workspaceId,
    itemId: items[0].id,
    locationId: locationIds[0],
    categoryId: categoryIds[0],
    customerId: customer.data.customer.id,
  }
}

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const
const SCHEMES = ["light", "dark"] as const

test.describe.configure({ mode: "serial" })

test("visual sweep", async ({ page, browser }) => {
  test.setTimeout(15 * 60_000)
  fs.mkdirSync(OUT, { recursive: true })

  await page.goto("/login")
  const ctx = await seed(page)
  const storage = await page.context().storageState()

  const publicPages = [
    ["landing", "/"],
    ["pricing", "/pricing"],
    ["terms", "/terms"],
  ] as const
  const authPages = [
    ["login", "/login"],
    ["signup", "/signup"],
    ["forgot-password", "/forgot-password"],
  ] as const
  const appPages = [
    ["overview", "/dashboard"],
    ["inventory", "/dashboard/items"],
    ["item-detail", `/dashboard/items/${ctx.itemId}`],
    ["locations", "/dashboard/locations"],
    ["location-detail", `/dashboard/locations/${ctx.locationId}`],
    ["categories", "/dashboard/categories"],
    ["category-detail", `/dashboard/categories/${ctx.categoryId}`],
    ["suppliers", "/dashboard/suppliers"],
    ["customers", "/dashboard/customers"],
    ["customer-detail", `/dashboard/customers/${ctx.customerId}`],
    ["activity", "/dashboard/activity"],
    ["reports", "/dashboard/analytics"],
    ["members", "/dashboard/members"],
    ["settings", "/dashboard/settings"],
    ["billing", "/dashboard/subscription"],
    ["not-found", "/dashboard/does-not-exist"],
  ] as const

  const report: Record<string, { errors: string[]; overflowX: boolean }> = {}

  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      const signedIn = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: scheme,
        storageState: storage,
        baseURL: test.info().project.use.baseURL,
      })
      const anon = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: scheme,
        baseURL: test.info().project.use.baseURL,
      })

      const shoot = async (context: typeof signedIn, name: string, url: string) => {
        const p = await context.newPage()
        const errors: string[] = []
        p.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text().slice(0, 300))
        })
        p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`.slice(0, 300)))
        await p.goto(url, { waitUntil: "networkidle" }).catch(() => undefined)
        await p.waitForTimeout(600)
        const overflowX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
        await p.screenshot({ path: path.join(OUT, `${vp.name}-${scheme}-${name}.png`), fullPage: true })
        report[`${vp.name}-${scheme}-${name}`] = { errors, overflowX }
        await p.close()
      }

      for (const [name, url] of publicPages) await shoot(anon, name, url)
      for (const [name, url] of authPages) await shoot(anon, name, url)
      for (const [name, url] of appPages) await shoot(signedIn, name, url)

      await signedIn.close()
      await anon.close()
    }
  }

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2))
  const problems = Object.entries(report).filter(([, v]) => v.errors.length > 0 || v.overflowX)
  console.log(`visual sweep: ${Object.keys(report).length} screenshots, ${problems.length} with console errors or horizontal overflow`)
  expect(Object.keys(report).length).toBeGreaterThan(0)
})
