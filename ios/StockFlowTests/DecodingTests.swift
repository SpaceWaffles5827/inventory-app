import Foundation
import Testing
@testable import StockFlow

/// Decodes real responses captured from the StockFlow API (Fixtures/*.json).
struct DecodingTests {
    private struct Envelope<T: Decodable>: Decodable { let data: T }

    private func load<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let data = try Fixture.data(name)
        return try JSON.decoder.decode(Envelope<T>.self, from: data).data
    }

    @Test func itemsPage() throws {
        let page = try load("items", as: ItemsPage.self)
        #expect(page.items.count == 4)
        let printer = try #require(page.items.first { $0.itemNumber == "ITM-010" })
        #expect(printer.name == "Label Printer 4in")
        #expect(printer.barcode == nil)
        #expect(printer.cost == 289)
        #expect(printer.onHand == 3)
        #expect(printer.category?.name == "Electronics")
        #expect(printer.locations?.first?.location?.code == "A-01-02")
        #expect(printer.locations?.first?.location?.structure.count == 4)
        #expect(page.nextCursor != nil)
    }

    @Test func itemDetailIgnoresExtraRelations() throws {
        let payload = try load("item-detail", as: ItemPayload.self)
        #expect(payload.item.itemNumber == "ITM-001")
        #expect(payload.item.lotTracking == false)
        #expect(payload.item.stockedLocations.count == 2)
        #expect(payload.item.stockedLocations.first?.quantity ?? 0 >= payload.item.stockedLocations.last?.quantity ?? 0)
    }

    @Test func locations() throws {
        let payload = try load("locations", as: LocationsPayload.self)
        #expect(payload.locations.count == 6)
        let a = try #require(payload.locations.first { $0.code == "A-01-01" })
        #expect(a.barcode == "LOC-A-01-01")
        #expect(a.path == "Zone A › Aisle 01 › Shelf 1 › Bin 1")
        #expect(a.totalUnits != nil)
        #expect(a.itemCount >= 1)
    }

    @Test func locationDetailItems() throws {
        let payload = try load("location-detail", as: LocationPayload.self)
        let items = try #require(payload.location.items)
        #expect(items.first?.name == "USB-C Cable 2m")
        #expect(items.first?.status == .inStock)
    }

    @Test func lotsWithLocationCodes() throws {
        let payload = try load("lots", as: LotsPayload.self)
        let lot = try #require(payload.lots.first { $0.lotNumber == "NG-2502-C" })
        #expect(lot.quantity == 60)
        #expect(lot.supplier?.name == "Northwind Traders")
        #expect(Set(lot.locations.compactMap(\.locationCode)) == ["B-02-01", "RECV"])
        #expect(lot.expirationDate != nil)
        let existing = try #require(payload.lots.first { $0.lotNumber == "EXISTING-STOCK" })
        #expect(existing.isSystem)
        #expect(existing.status == .depleted)
    }

    @Test func transactionsFeed() throws {
        let page = try load("transactions", as: TransactionsPage.self)
        #expect(page.transactions.count == 5)
        let transfer = try #require(page.transactions.first { $0.type == .transfer })
        #expect(transfer.fromLocation != nil && transfer.toLocation != nil)
        #expect(transfer.signedQuantity == 0)
        #expect(transfer.locationSummary?.contains("→") == true)
        #expect(transfer.user?.name == "Jordan Rivera")
    }

    @Test func dashboardSummary() throws {
        let summary = try load("dashboard", as: DashboardSummary.self)
        #expect(summary.totalSkus == 10)
        #expect(summary.inventoryValue > 0)
        #expect(summary.lowStockItems.count == summary.lowStockCount + summary.outOfStockCount)
        #expect(!summary.recentTransactions.isEmpty)
    }

    @Test func analytics() throws {
        let analytics = try load("analytics", as: Analytics.self)
        #expect(analytics.movementData.count == 7)
        #expect(analytics.keyMetrics.unitsIn >= analytics.keyMetrics.unitsOut)
    }

    @Test func workspacesWithRole() throws {
        let payload = try load("workspaces", as: WorkspacesPayload.self)
        let workspace = try #require(payload.workspaces.first)
        #expect(workspace.name == "Riverside Warehouse")
        #expect(workspace.role == .owner)
        #expect(workspace.counts?.items == 10)
        #expect(workspace.subscription?.plan == "STARTER")
    }

    @Test func unknownEnumValuesFallBack() throws {
        let json = #"{"id":"l1","lotNumber":"X","quantity":1,"initialQuantity":1,"status":"ON_HOLD","isSystem":false,"itemId":"i1","locations":[]}"#
        let lot = try JSON.decoder.decode(Lot.self, from: Data(json.utf8))
        #expect(lot.status == .active)
    }

    @Test func legacyNumericStructureValues() throws {
        let json = #"{"id":"l1","code":"A1","structure":[{"label":"Aisle","value":3}],"capacity":50}"#
        let location = try JSON.decoder.decode(Location.self, from: Data(json.utf8))
        #expect(location.path == "Aisle 3")
    }

    @Test func malformedStructureDoesNotFailTheLocation() throws {
        let json = #"{"id":"l1","code":"A1","structure":{"levels":[]},"capacity":50}"#
        let location = try JSON.decoder.decode(Location.self, from: Data(json.utf8))
        #expect(location.structure.isEmpty)
        #expect(location.code == "A1")
    }
}

enum Fixture {
    private final class Token {}

    static func data(_ name: String) throws -> Data {
        let bundle = Bundle(for: Token.self)
        let url = bundle.url(forResource: name, withExtension: "json")
            ?? bundle.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")
        guard let url else { throw FixtureError.missing(name) }
        return try Data(contentsOf: url)
    }

    enum FixtureError: Error { case missing(String) }
}
