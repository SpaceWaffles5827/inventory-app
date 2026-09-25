import Foundation
import Observation

/// What a scanned code resolved to.
enum ScanMatch: Equatable {
    case item(Item)
    case location(Location)
    case unknown(String)
}

/// Workspace-scoped cache of the catalog: items, locations, categories and suppliers.
/// Screens read from here so lists, pickers and the scanner stay in sync after every change.
@MainActor
@Observable
final class InventoryStore {
    let api: APIClient
    let workspaceId: String

    private(set) var items: [Item] = []
    private(set) var locations: [Location] = []
    private(set) var categories: [Category] = []
    private(set) var suppliers: [Supplier] = []
    private(set) var hasLoadedItems = false
    private(set) var hasLoadedLocations = false
    private(set) var isRefreshing = false

    /// Bumped after any stock change so dependent screens (overview, activity) reload.
    private(set) var revision = 0

    init(api: APIClient, workspaceId: String) {
        self.api = api
        self.workspaceId = workspaceId
    }

    // MARK: Loading

    func refreshAll() async {
        isRefreshing = true
        defer { isRefreshing = false }
        async let items: Void = refreshItems()
        async let locations: Void = refreshLocations()
        async let reference: Void = refreshReferenceData()
        _ = try? await (items, locations, reference)
    }

    func refreshItems() async throws {
        let fresh = try await api.items(workspaceId: workspaceId)
        items = fresh
        hasLoadedItems = true
    }

    func refreshLocations() async throws {
        let fresh = try await api.locations(workspaceId: workspaceId)
        locations = fresh
        hasLoadedLocations = true
    }

    func refreshReferenceData() async throws {
        async let categories = api.categories(workspaceId: workspaceId)
        async let suppliers = api.suppliers(workspaceId: workspaceId)
        let (c, s) = try await (categories, suppliers)
        self.categories = c
        self.suppliers = s
    }

    func ensureLoaded() async {
        if !hasLoadedItems || !hasLoadedLocations { await refreshAll() }
    }

    // MARK: Lookup

    func item(id: String) -> Item? { items.first { $0.id == id } }
    func location(id: String) -> Location? { locations.first { $0.id == id } }

    func match(code: String) -> ScanMatch {
        if let item = CodeMatcher.item(in: items, code: code) { return .item(item) }
        if let location = CodeMatcher.location(in: locations, code: code) { return .location(location) }
        return .unknown(code.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// Resolve a code, refreshing the catalog once if it isn't found (it may have been created on the web).
    func resolve(code: String) async -> ScanMatch {
        let first = match(code: code)
        guard case .unknown = first else { return first }
        async let items: Void = refreshItems()
        async let locations: Void = refreshLocations()
        _ = try? await (items, locations)
        return match(code: code)
    }

    // MARK: Mutations

    /// Replace (or insert) an item after the server returned its new state.
    func apply(_ item: Item) {
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index] = item
        } else {
            items.insert(item, at: 0)
        }
        revision += 1
    }

    func remove(itemId: String) {
        items.removeAll { $0.id == itemId }
        revision += 1
    }

    func apply(_ location: Location) {
        if let index = locations.firstIndex(where: { $0.id == location.id }) {
            var merged = location
            if merged.totalUnits == nil { merged.totalUnits = locations[index].totalUnits }
            locations[index] = merged
        } else {
            locations.append(location)
            locations.sort { $0.code.localizedStandardCompare($1.code) == .orderedAscending }
        }
    }

    func remove(locationId: String) {
        locations.removeAll { $0.id == locationId }
    }

    func add(_ category: Category) {
        categories.append(category)
        categories.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func add(_ supplier: Supplier) {
        suppliers.append(supplier)
        suppliers.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    /// Re-fetch an item (and location totals) after a stock movement.
    func reload(itemId: String) async {
        if let fresh = try? await api.item(id: itemId) { apply(fresh) }
        try? await refreshLocations()
    }

    func markChanged() { revision += 1 }
}
