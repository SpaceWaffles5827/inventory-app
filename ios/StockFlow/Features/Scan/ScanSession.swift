import SwiftUI
import Observation

enum ScanMode: String, CaseIterable, Identifiable {
    case find, receive, pick, move, count
    var id: String { rawValue }

    var title: String {
        switch self {
        case .find: "Find"
        case .receive: "Receive"
        case .pick: "Pick"
        case .move: "Move"
        case .count: "Count"
        }
    }

    var symbol: String {
        switch self {
        case .find: "magnifyingglass"
        case .receive: "tray.and.arrow.down.fill"
        case .pick: "tray.and.arrow.up.fill"
        case .move: "arrow.left.arrow.right"
        case .count: "checklist"
        }
    }

    var tint: Color {
        switch self {
        case .find: .accentColor
        case .receive: .green
        case .pick: .orange
        case .move: .blue
        case .count: .purple
        }
    }

    var direction: StockDirection? {
        switch self {
        case .receive: .input
        case .pick: .output
        default: nil
        }
    }

    /// What to tell the user before anything is scanned.
    var prompt: String {
        switch self {
        case .find: "Scan an item or location barcode"
        case .receive: "Scan items to receive. Scan a location to receive into it."
        case .pick: "Scan items to pick. Scan a location to pick from it."
        case .move: "Scan the item you want to move"
        case .count: "Scan a location to start counting"
        }
    }
}

/// One scanned item in a batch (receive / pick / count).
struct CartLine: Identifiable, Equatable {
    var item: Item
    var quantity: Int
    var error: String?

    var id: String { item.id }
}

/// State of the scanner screen, kept separate from the view so it can be unit tested.
@MainActor
@Observable
final class ScanSession {
    var mode: ScanMode = .find {
        didSet { if oldValue != mode { resetForMode() } }
    }

    /// Last lookup result in Find mode.
    var result: ScanMatch?
    /// Batch lines for receive / pick / count.
    private(set) var cart: [CartLine] = []
    /// Location context: receive-into, pick-from, count-at, or move-from.
    var location: Location?
    /// Move mode: the item being moved.
    var moveItem: Item?
    /// Count mode: expected quantity per item at `location`.
    var expected: [String: Int] = [:]
    var expectedItems: [LocationItem] = []

    /// Short message shown under the viewfinder after each scan.
    var banner: ScanBanner?

    var totalUnits: Int { cart.reduce(0) { $0 + $1.quantity } }

    func resetForMode() {
        result = nil
        cart = []
        moveItem = nil
        expected = [:]
        expectedItems = []
        banner = nil
        if mode == .move || mode == .find { location = nil }
    }

    /// Adds one unit of an item to the batch, returning the new quantity.
    @discardableResult
    func increment(_ item: Item, by amount: Int = 1) -> Int {
        if let index = cart.firstIndex(where: { $0.id == item.id }) {
            cart[index].quantity += amount
            cart[index].item = item
            cart[index].error = nil
            let line = cart.remove(at: index)
            cart.insert(line, at: 0)
            return line.quantity
        }
        cart.insert(CartLine(item: item, quantity: amount), at: 0)
        return amount
    }

    func setQuantity(_ quantity: Int, for itemId: String) {
        guard let index = cart.firstIndex(where: { $0.id == itemId }) else { return }
        if quantity <= 0 {
            cart.remove(at: index)
        } else {
            cart[index].quantity = quantity
        }
    }

    func remove(itemId: String) {
        cart.removeAll { $0.id == itemId }
    }

    func setError(_ message: String?, for itemId: String) {
        guard let index = cart.firstIndex(where: { $0.id == itemId }) else { return }
        cart[index].error = message
    }

    func clearCart() {
        cart = []
    }

    /// Count mode: difference between counted and expected for a line.
    func variance(for line: CartLine) -> Int {
        line.quantity - (expected[line.item.id] ?? 0)
    }
}

struct ScanBanner: Equatable, Identifiable {
    enum Style { case info, success, warning }
    let id = UUID()
    let text: String
    var style: Style = .info
    /// Offer "Create item" for this unknown code.
    var createCode: String? = nil

    static func == (lhs: ScanBanner, rhs: ScanBanner) -> Bool { lhs.id == rhs.id }
}
