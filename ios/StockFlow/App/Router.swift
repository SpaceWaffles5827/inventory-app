import SwiftUI
import Observation

enum AppTab: Hashable {
    case overview, inventory, scan, locations, activity
}

/// Navigation values pushed onto the tab stacks.
struct ItemRoute: Hashable { let id: String }
struct LocationRoute: Hashable { let id: String }
struct LotRoute: Hashable { let id: String }

/// Sheets that can be opened from anywhere (deep links, quick actions, scanner).
enum AppSheet: Identifiable, Equatable {
    case settings
    case newItem(barcode: String?)
    case item(id: String)
    case location(id: String)

    var id: String {
        switch self {
        case .settings: "settings"
        case .newItem(let barcode): "new-\(barcode ?? "")"
        case .item(let id): "item-\(id)"
        case .location(let id): "location-\(id)"
        }
    }
}

@MainActor
@Observable
final class Router {
    var tab: AppTab = .overview
    var overviewPath = NavigationPath()
    var inventoryPath = NavigationPath()
    var locationsPath = NavigationPath()
    var activityPath = NavigationPath()
    var sheet: AppSheet?

    /// Scanner mode requested from outside the scan tab (quick action, overview shortcut).
    var requestedScanMode: ScanMode?
    /// A code injected from a deep link (`stockflow://scan?code=…`), handled by the scan tab.
    var pendingScanCode: String?
    /// Inventory filter requested from another screen (e.g. tapping "Low stock").
    var requestedInventoryFilter: InventoryFilter?

    func showItem(_ id: String) {
        tab = .inventory
        inventoryPath.append(ItemRoute(id: id))
    }

    func showLocation(_ id: String) {
        tab = .locations
        locationsPath.append(LocationRoute(id: id))
    }

    func openScanner(mode: ScanMode = .find) {
        requestedScanMode = mode
        tab = .scan
    }

    /// Tapping the selected tab again pops to its root, like system apps.
    func popToRoot(_ tab: AppTab) {
        switch tab {
        case .overview: overviewPath = NavigationPath()
        case .inventory: inventoryPath = NavigationPath()
        case .locations: locationsPath = NavigationPath()
        case .activity: activityPath = NavigationPath()
        case .scan: break
        }
    }

    // MARK: Deep links: stockflow://item/<id>, stockflow://location/<id>, stockflow://scan?code=…

    func handle(url: URL) {
        guard url.scheme == "stockflow" else { return }
        let host = url.host() ?? ""
        let parts = url.pathComponents.filter { $0 != "/" }
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        switch host {
        case "item":
            if let id = parts.first { sheet = nil; showItem(id) }
        case "location":
            if let id = parts.first { sheet = nil; showLocation(id) }
        case "scan":
            sheet = nil
            if let mode = query.first(where: { $0.name == "mode" })?.value.flatMap(ScanMode.init(rawValue:)) {
                requestedScanMode = mode
            }
            if let code = query.first(where: { $0.name == "code" })?.value, !code.isEmpty {
                pendingScanCode = code
            }
            tab = .scan
        case "new-item":
            sheet = .newItem(barcode: query.first(where: { $0.name == "barcode" })?.value)
        default:
            break
        }
    }

    func handleShortcut(_ type: String) {
        switch type {
        case "com.stockflow.scan": openScanner(mode: .find)
        case "com.stockflow.receive": openScanner(mode: .receive)
        case "com.stockflow.newItem": sheet = .newItem(barcode: nil)
        default: break
        }
    }
}
