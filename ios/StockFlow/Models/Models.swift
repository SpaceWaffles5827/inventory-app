import Foundation

// Response models for the StockFlow API. Field names mirror the Prisma models
// (see prisma/schema.prisma); only the fields the app uses are declared.

struct User: Decodable, Identifiable, Hashable {
    let id: String
    let email: String
    var name: String?

    var displayName: String {
        if let name, !name.trimmingCharacters(in: .whitespaces).isEmpty { return name }
        return email
    }

    var initials: String {
        let parts = displayName.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first.map(String.init) }.joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }
}

struct Workspace: Decodable, Identifiable, Hashable {
    let id: String
    var name: String
    var description: String?
    var members: [Membership]?
    var subscription: Subscription?
    var counts: Counts?

    struct Membership: Decodable, Hashable {
        let role: Role
    }

    struct Subscription: Decodable, Hashable {
        var plan: String?
        var status: String?
        var currentPeriodEnd: Date?
    }

    struct Counts: Decodable, Hashable {
        var items: Int?
        var members: Int?
    }

    enum CodingKeys: String, CodingKey {
        case id, name, description, members, subscription
        case counts = "_count"
    }

    /// The signed-in user's role (the list endpoint only returns the caller's membership).
    var role: Role { members?.first?.role ?? .member }
}

struct Category: Decodable, Identifiable, Hashable {
    let id: String
    var name: String
    var description: String?
    var itemCount: Int?
}

struct Supplier: Decodable, Identifiable, Hashable {
    let id: String
    var name: String
    var contactPerson: String?
    var email: String?
    var phone: String?
    var address: String?
    var isActive: Bool?
}

struct Item: Decodable, Identifiable, Hashable {
    let id: String
    var itemNumber: String
    var name: String
    var barcode: String?
    var unit: String?
    var description: String?
    var cost: Double
    var status: ItemStatus
    var reorderPoint: Int
    var lotTracking: Bool
    var createdAt: Date
    var updatedAt: Date
    var workspaceId: String
    var categoryId: String?
    var supplierId: String?
    var category: Category?
    var supplier: Supplier?
    var locations: [ItemLocation]?
    var onHand: Int

    var unitLabel: String { (unit?.isEmpty == false ? unit! : "units") }
    var value: Double { Double(onHand) * cost }

    /// Locations that currently hold stock of this item, largest first.
    var stockedLocations: [ItemLocation] {
        (locations ?? []).filter { $0.quantity > 0 }.sorted { $0.quantity > $1.quantity }
    }

    /// Fill level relative to the reorder point (1 = at 2x reorder point or more).
    var stockLevel: Double {
        guard reorderPoint > 0 else { return onHand > 0 ? 1 : 0 }
        return min(1, max(0, Double(onHand) / Double(reorderPoint * 2)))
    }
}

struct ItemLocation: Decodable, Identifiable, Hashable {
    let id: String
    var quantity: Int
    var minStock: Int?
    var maxStock: Int?
    var notes: String?
    var itemId: String
    var locationId: String
    var location: Location?

    var code: String { location?.code ?? "—" }
}

struct StructureLevel: Decodable, Hashable {
    var label: String
    var value: String

    enum CodingKeys: String, CodingKey { case label, value }

    init(label: String, value: String) {
        self.label = label
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        label = (try? c.decode(String.self, forKey: .label)) ?? ""
        value = (try? c.decode(LenientString.self, forKey: .value))?.value ?? ""
    }
}

struct Location: Decodable, Identifiable, Hashable {
    let id: String
    var code: String
    var barcode: String?
    var structure: [StructureLevel]
    var capacity: Int
    var description: String?
    var totalUnits: Int?
    var counts: Counts?
    var items: [LocationItem]?

    struct Counts: Decodable, Hashable {
        var items: Int?
    }

    enum CodingKeys: String, CodingKey {
        case id, code, barcode, structure, capacity, description, totalUnits, items
        case counts = "_count"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        code = try c.decode(String.self, forKey: .code)
        barcode = try c.decodeIfPresent(String.self, forKey: .barcode)
        structure = (try? c.decode([StructureLevel].self, forKey: .structure)) ?? []
        capacity = (try? c.decode(Int.self, forKey: .capacity)) ?? 0
        description = try c.decodeIfPresent(String.self, forKey: .description)
        totalUnits = try c.decodeIfPresent(Int.self, forKey: .totalUnits)
        counts = try c.decodeIfPresent(Counts.self, forKey: .counts)
        items = try c.decodeIfPresent([LocationItem].self, forKey: .items)
    }

    init(id: String, code: String, barcode: String? = nil, structure: [StructureLevel] = [], capacity: Int = 100,
         description: String? = nil, totalUnits: Int? = nil) {
        self.id = id
        self.code = code
        self.barcode = barcode
        self.structure = structure
        self.capacity = capacity
        self.description = description
        self.totalUnits = totalUnits
    }

    /// "Zone A › Aisle 3 › Shelf 2", skipping empty levels.
    var path: String {
        structure
            .filter { !$0.value.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { "\($0.label) \($0.value)" }
            .joined(separator: " › ")
    }

    var itemCount: Int { counts?.items ?? items?.count ?? 0 }

    var utilization: Double? {
        guard capacity > 0, let totalUnits else { return nil }
        return Double(totalUnits) / Double(capacity)
    }
}

struct LocationItem: Decodable, Identifiable, Hashable {
    let id: String
    var itemNumber: String
    var name: String
    var status: ItemStatus
    var unit: String?
    var quantity: Int
    var minStock: Int?
    var maxStock: Int?
    var notes: String?
}

struct PersonRef: Decodable, Hashable {
    let id: String
    var name: String?
    var email: String?

    var displayName: String { name?.isEmpty == false ? name! : (email ?? "Someone") }
}

struct ItemRef: Decodable, Identifiable, Hashable {
    let id: String
    var name: String
    var itemNumber: String
    var unit: String?
}

struct LotRef: Decodable, Identifiable, Hashable {
    let id: String
    var lotNumber: String
}

struct LocationRef: Decodable, Hashable {
    var id: String?
    var code: String
}

struct Lot: Decodable, Identifiable, Hashable {
    let id: String
    var lotNumber: String
    var quantity: Int
    var initialQuantity: Int
    var receivedDate: Date?
    var manufactureDate: Date?
    var expirationDate: Date?
    var status: LotStatus
    var poNumber: String?
    var notes: String?
    var isSystem: Bool
    var itemId: String
    var supplier: Supplier?
    var creator: PersonRef?
    var locations: [LotLocation]
    var item: ItemRef?

    var stockedLocations: [LotLocation] { locations.filter { $0.quantity > 0 } }

    /// Lot dates are calendar days stored as UTC midnight; these give the local day.
    var expiryDay: Date? { expirationDate.map(DateOnly.localDay(fromStored:)) }
    var manufactureDay: Date? { manufactureDate.map(DateOnly.localDay(fromStored:)) }

    var daysUntilExpiry: Int? {
        guard let expiryDay else { return nil }
        let start = Calendar.current.startOfDay(for: .now)
        return Calendar.current.dateComponents([.day], from: start, to: expiryDay).day
    }

    var isExpired: Bool { (daysUntilExpiry ?? 1) < 0 }

    /// Only ACTIVE lots can be picked from without a warning.
    var isUsable: Bool { status == .active && !isExpired }
}

struct LotLocation: Decodable, Identifiable, Hashable {
    let id: String
    var lotId: String
    var locationId: String
    var quantity: Int
    var locationCode: String?

    var code: String { locationCode ?? "—" }
}

struct StockTransaction: Decodable, Identifiable, Hashable {
    let id: String
    let type: TransactionType
    let quantity: Int
    let reason: String?
    let previousStock: Int?
    let newStock: Int?
    let createdAt: Date
    let item: ItemRef?
    let lot: LotRef?
    let fromLocation: LocationRef?
    let toLocation: LocationRef?
    let user: PersonRef?

    /// Signed change to the item's total (transfers don't change it).
    var signedQuantity: Int {
        switch type {
        case .input: quantity
        case .output: -quantity
        case .transfer: 0
        }
    }

    var locationSummary: String? {
        switch type {
        case .input: toLocation.map { "into \($0.code)" }
        case .output: fromLocation.map { "from \($0.code)" }
        case .transfer:
            if let from = fromLocation, let to = toLocation { "\(from.code) → \(to.code)" } else { nil }
        }
    }
}

struct LowStockEntry: Decodable, Identifiable, Hashable {
    let id: String
    var name: String
    var itemNumber: String
    var onHand: Int
    var reorderPoint: Int
    var unit: String?
}

struct DashboardSummary: Decodable, Hashable {
    var totalSkus: Int
    var totalUnits: Int
    var inventoryValue: Double
    var lowStockCount: Int
    var outOfStockCount: Int
    var locationsCount: Int
    var recentTransactions: [StockTransaction]
    var lowStockItems: [LowStockEntry]
}

struct Analytics: Decodable, Hashable {
    var keyMetrics: KeyMetrics
    var movementData: [MovementPoint]

    struct KeyMetrics: Decodable, Hashable {
        var unitsIn: Int
        var unitsOut: Int
        var netMovement: Int
        var transactionCount: Int
    }

    struct MovementPoint: Decodable, Hashable, Identifiable {
        var month: String
        var label: String
        var stockIn: Int
        var stockOut: Int
        var net: Int
        var transfers: Int

        var id: String { month }
    }
}

struct ItemImage: Decodable, Identifiable, Hashable {
    let id: String
    var itemId: String
    var isPrimary: Bool
    var displayOrder: Int
    var uploadedAt: Date?
}

struct StructureTemplate: Decodable, Hashable {
    struct Level: Decodable, Hashable {
        var label: String
    }

    var levels: [Level]
}

// MARK: - Payload wrappers (`data` of each endpoint)

struct UserPayload: Decodable { let user: User }
struct WorkspacesPayload: Decodable { let workspaces: [Workspace] }
struct WorkspacePayload: Decodable { let workspace: Workspace }
struct ItemsPage: Decodable { let items: [Item]; let nextCursor: String? }
struct ItemPayload: Decodable { let item: Item }
struct LocationsPayload: Decodable { let locations: [Location] }
struct LocationPayload: Decodable { let location: Location }
struct LotsPayload: Decodable { let lots: [Lot] }
struct LotPayload: Decodable { let lot: Lot }
struct CategoriesPayload: Decodable { let categories: [Category] }
struct CategoryPayload: Decodable { let category: Category }
struct SuppliersPayload: Decodable { let suppliers: [Supplier] }
struct SupplierPayload: Decodable { let supplier: Supplier }
struct TransactionsPage: Decodable { let transactions: [StockTransaction]; let nextCursor: String? }
struct ImagesPayload: Decodable { let images: [ItemImage] }
struct ImagePayload: Decodable { let image: ItemImage }
struct StructurePayload: Decodable { let structure: StructureTemplate? }
