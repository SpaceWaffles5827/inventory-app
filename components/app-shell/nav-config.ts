import {
  LayoutDashboard,
  Package,
  MapPin,
  FolderTree,
  History,
  BarChart3,
  Truck,
  Users,
  UserCog,
  Settings,
  CreditCard,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  /** Extra words the command palette should match */
  keywords?: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Warehouse",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "dashboard"] },
      { name: "Inventory", href: "/dashboard/items", icon: Package, keywords: ["items", "products", "stock", "sku"] },
      { name: "Locations", href: "/dashboard/locations", icon: MapPin, keywords: ["bins", "shelves", "warehouse"] },
      { name: "Categories", href: "/dashboard/categories", icon: FolderTree },
      { name: "Activity", href: "/dashboard/activity", icon: History, keywords: ["history", "transactions", "movements", "log"] },
      { name: "Reports", href: "/dashboard/analytics", icon: BarChart3, keywords: ["analytics", "charts"] },
    ],
  },
  {
    label: "Partners",
    items: [
      { name: "Suppliers", href: "/dashboard/suppliers", icon: Truck, keywords: ["vendors"] },
      { name: "Customers", href: "/dashboard/customers", icon: Users, keywords: ["clients"] },
    ],
  },
  {
    label: "Workspace",
    items: [
      { name: "Members", href: "/dashboard/members", icon: UserCog, keywords: ["team", "users", "invite"] },
      { name: "Billing", href: "/dashboard/subscription", icon: CreditCard, keywords: ["subscription", "plan"] },
      { name: "Settings", href: "/dashboard/settings", icon: Settings, keywords: ["profile", "password", "preferences"] },
    ],
  },
]

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

/** Tabs shown in the mobile bottom bar (the scan button sits in the middle) */
export const MOBILE_TABS: NavItem[] = [ALL_NAV_ITEMS[0], ALL_NAV_ITEMS[1], ALL_NAV_ITEMS[2]]

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(href + "/")
}
