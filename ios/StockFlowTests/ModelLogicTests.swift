import Foundation
import Testing
@testable import StockFlow

struct ServerURLTests {
    @Test(arguments: [
        ("inventory.acme.com", "https://inventory.acme.com"),
        ("localhost:5001", "http://localhost:5001"),
        ("192.168.1.20:5001/", "http://192.168.1.20:5001"),
        ("https://acme.com/api", "https://acme.com"),
        ("  http://warehouse.local:5001  ", "http://warehouse.local:5001"),
    ])
    func normalizes(input: String, expected: String) {
        #expect(Preferences.normalizedServerURL(input)?.absoluteString == expected)
    }

    @Test(arguments: ["", "https://", "ftp://files.example.com", "not a url"])
    func rejects(input: String) {
        #expect(Preferences.normalizedServerURL(input) == nil)
    }
}

struct StatusTests {
    @Test func matchesServerRule() {
        #expect(ItemStatus.derive(onHand: 0, reorderPoint: 10) == .outOfStock)
        #expect(ItemStatus.derive(onHand: -2, reorderPoint: 0) == .outOfStock)
        #expect(ItemStatus.derive(onHand: 10, reorderPoint: 10) == .lowStock)
        #expect(ItemStatus.derive(onHand: 11, reorderPoint: 10) == .inStock)
        #expect(ItemStatus.derive(onHand: 1, reorderPoint: 0) == .inStock)
    }

    @Test func roleOrdering() {
        #expect(Role.owner > Role.admin)
        #expect(Role.admin > Role.member)
        #expect(Role.member >= Role.member)
    }
}

struct DateOnlyTests {
    @Test func storedUTCMidnightKeepsItsCalendarDay() throws {
        // 2027-03-24T00:00:00Z must read as March 24 in every time zone.
        let stored = try #require(DateParsing.parse("2027-03-24T00:00:00.000Z"))
        let day = DateOnly.localDay(fromStored: stored)
        let c = Calendar.current.dateComponents([.year, .month, .day], from: day)
        #expect(c.year == 2027 && c.month == 3 && c.day == 24)
    }

    @Test func formatsLocalDay() throws {
        let date = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 4, hour: 23)))
        #expect(DateOnly.string(from: date) == "2026-09-04")
    }

    @Test func parsesServerDates() {
        #expect(DateParsing.parse("2026-09-25T00:27:22.305Z") != nil)
        #expect(DateParsing.parse("2026-09-25T00:27:22Z") != nil)
        #expect(DateParsing.parse("2026-09-25") != nil)
        #expect(DateParsing.parse("yesterday") == nil)
    }
}

@MainActor
struct ScanSessionTests {
    private func item(_ id: String, name: String = "Thing", onHand: Int = 5) throws -> Item {
        let json = """
        {"id":"\(id)","itemNumber":"ITM-\(id)","name":"\(name)","cost":1,"status":"IN_STOCK","reorderPoint":1,
         "lotTracking":false,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z",
         "workspaceId":"w","onHand":\(onHand)}
        """
        return try JSON.decoder.decode(Item.self, from: Data(json.utf8))
    }

    @Test func repeatedScansIncrementAndMoveToTop() throws {
        let session = ScanSession()
        session.mode = .receive
        let a = try item("1", name: "A")
        let b = try item("2", name: "B")
        #expect(session.increment(a) == 1)
        #expect(session.increment(b) == 1)
        #expect(session.increment(a) == 2)
        #expect(session.cart.map(\.id) == ["1", "2"])
        #expect(session.totalUnits == 3)
    }

    @Test func settingQuantityToZeroRemovesLine() throws {
        let session = ScanSession()
        let a = try item("1")
        session.increment(a, by: 3)
        session.setQuantity(0, for: "1")
        #expect(session.cart.isEmpty)
    }

    @Test func switchingModeResetsBatch() throws {
        let session = ScanSession()
        session.mode = .pick
        session.increment(try item("1"))
        session.mode = .find
        #expect(session.cart.isEmpty)
        #expect(session.location == nil)
    }

    @Test func countVariance() throws {
        let session = ScanSession()
        session.mode = .count
        session.expected = ["1": 8]
        session.increment(try item("1"), by: 7)
        session.increment(try item("2"), by: 2)
        #expect(session.variance(for: session.cart.first { $0.id == "1" }!) == -1)
        #expect(session.variance(for: session.cart.first { $0.id == "2" }!) == 2)
    }

    @Test func scanErrorsClearOnRescan() throws {
        let session = ScanSession()
        let a = try item("1")
        session.increment(a)
        session.setError("No stock", for: "1")
        #expect(session.cart.first?.error == "No stock")
        session.increment(a)
        #expect(session.cart.first?.error == nil)
    }
}

@MainActor
struct RouterTests {
    @Test func deepLinksOpenTheRightPlace() throws {
        let router = Router()
        router.handle(url: try #require(URL(string: "stockflow://item/abc123")))
        #expect(router.tab == .inventory)
        #expect(router.inventoryPath.count == 1)

        router.handle(url: try #require(URL(string: "stockflow://scan?code=0123&mode=receive")))
        #expect(router.tab == .scan)
        #expect(router.pendingScanCode == "0123")
        #expect(router.requestedScanMode == .receive)

        router.handle(url: try #require(URL(string: "stockflow://new-item?barcode=999")))
        #expect(router.sheet == .newItem(barcode: "999"))
    }

    @Test func quickActions() {
        let router = Router()
        router.handleShortcut("com.stockflow.receive")
        #expect(router.tab == .scan)
        #expect(router.requestedScanMode == .receive)
        router.handleShortcut("com.stockflow.newItem")
        #expect(router.sheet == .newItem(barcode: nil))
    }

    @Test func ignoresOtherSchemes() throws {
        let router = Router()
        router.handle(url: try #require(URL(string: "https://example.com/item/1")))
        #expect(router.tab == .overview)
    }
}

struct CodeRendererTests {
    @Test func rendersBothSymbologies() {
        #expect(CodeRenderer.image(for: "ITM-001", kind: .barcode) != nil)
        #expect(CodeRenderer.image(for: "LOC-A-01-01", kind: .qr) != nil)
        #expect(CodeRenderer.image(for: "", kind: .qr) == nil)
    }
}
