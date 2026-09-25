import SwiftUI

/// Enums decode unknown server values to a safe fallback instead of failing the whole response.
protocol FallbackDecodable: RawRepresentable, Decodable where RawValue == String {
    static var fallback: Self { get }
}

extension FallbackDecodable {
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: raw) ?? Self.fallback
    }
}

enum Role: String, FallbackDecodable, Comparable, CaseIterable {
    case owner = "OWNER", admin = "ADMIN", member = "MEMBER"
    static let fallback = Role.member

    private var rank: Int {
        switch self {
        case .member: 1
        case .admin: 2
        case .owner: 3
        }
    }

    static func < (lhs: Role, rhs: Role) -> Bool { lhs.rank < rhs.rank }

    var title: String {
        switch self {
        case .owner: "Owner"
        case .admin: "Admin"
        case .member: "Member"
        }
    }
}

enum ItemStatus: String, FallbackDecodable, CaseIterable {
    case inStock = "IN_STOCK", lowStock = "LOW_STOCK", outOfStock = "OUT_OF_STOCK"
    static let fallback = ItemStatus.inStock

    var title: String {
        switch self {
        case .inStock: "In stock"
        case .lowStock: "Low stock"
        case .outOfStock: "Out of stock"
        }
    }

    var color: Color {
        switch self {
        case .inStock: .green
        case .lowStock: .orange
        case .outOfStock: .red
        }
    }

    var symbol: String {
        switch self {
        case .inStock: "checkmark.circle.fill"
        case .lowStock: "exclamationmark.triangle.fill"
        case .outOfStock: "xmark.octagon.fill"
        }
    }

    /// Same rule as the server: out when on hand <= 0, low when on hand <= reorder point.
    static func derive(onHand: Int, reorderPoint: Int) -> ItemStatus {
        if onHand <= 0 { return .outOfStock }
        if onHand <= reorderPoint { return .lowStock }
        return .inStock
    }
}

enum LotStatus: String, FallbackDecodable, CaseIterable, Encodable {
    case active = "ACTIVE", depleted = "DEPLETED", expired = "EXPIRED", quarantined = "QUARANTINED", recalled = "RECALLED"
    static let fallback = LotStatus.active

    var title: String { rawValue.capitalized }

    var color: Color {
        switch self {
        case .active: .green
        case .depleted: .secondary
        case .expired: .red
        case .quarantined: .orange
        case .recalled: .purple
        }
    }
}

enum TransactionType: String, FallbackDecodable, CaseIterable, Encodable {
    case input = "INPUT", output = "OUTPUT", transfer = "TRANSFER"
    static let fallback = TransactionType.input

    var title: String {
        switch self {
        case .input: "Added"
        case .output: "Removed"
        case .transfer: "Moved"
        }
    }

    var filterTitle: String {
        switch self {
        case .input: "Stock in"
        case .output: "Stock out"
        case .transfer: "Transfers"
        }
    }

    var symbol: String {
        switch self {
        case .input: "arrow.down.to.line"
        case .output: "arrow.up.right"
        case .transfer: "arrow.left.arrow.right"
        }
    }

    var color: Color {
        switch self {
        case .input: .green
        case .output: .red
        case .transfer: .blue
        }
    }
}

/// Direction of a simple stock adjustment.
enum StockDirection: String, Encodable, CaseIterable, Identifiable {
    case input = "INPUT", output = "OUTPUT"
    var id: String { rawValue }

    var title: String { self == .input ? "Add" : "Remove" }
    var verb: String { self == .input ? "Add stock" : "Remove stock" }
    var symbol: String { self == .input ? "plus" : "minus" }
    var color: Color { self == .input ? .green : .red }
}
