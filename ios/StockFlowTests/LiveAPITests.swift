import Foundation
import Testing
import UIKit
@testable import StockFlow

/// End-to-end checks against a running StockFlow server. Opt-in:
///
///     TEST_RUNNER_STOCKFLOW_TEST_SERVER=http://localhost:5100 xcodebuild test …
///
/// Each run registers a throwaway user (or signs in with STOCKFLOW_TEST_EMAIL /
/// STOCKFLOW_TEST_PASSWORD) and works inside that user's own workspace.
@Suite(.serialized, .enabled(if: LiveServer.url != nil, "Set STOCKFLOW_TEST_SERVER to run live API tests"))
struct LiveAPITests {
    @Test func fullStockLifecycle() async throws {
        let api = try await LiveServer.signedInClient()
        let workspace = try #require(try await api.workspaces().first)
        let suffix = String(UUID().uuidString.prefix(6))
        let digits = String(Int.random(in: 100_000...999_999))

        // Locations
        func level(_ label: String, _ value: String) -> LocationBody.Level { .init(label: label, value: value) }
        let shelf = try await api.createLocation(LocationBody(
            workspaceId: workspace.id, code: "T-\(suffix)-1",
            structure: [level("Zone", "T"), level("Shelf", "1")], capacity: 50
        ))
        let bin = try await api.createLocation(LocationBody(
            workspaceId: workspace.id, code: "T-\(suffix)-2",
            structure: [level("Zone", "T"), level("Shelf", "2")], capacity: 50
        ))
        #expect(shelf.barcode == "LOC-T-\(suffix)-1")

        // Item with starting stock
        var item = try await api.createItem(CreateItemBody(
            workspaceId: workspace.id, name: "Live Test \(suffix)", barcode: "0099\(digits)",
            unit: "EA", onHand: 10, cost: 2.5, reorderPoint: 4, locationIds: [shelf.id]
        ))
        #expect(item.onHand == 10)
        #expect(item.status == .inStock)

        // Adjust in and out
        item = try await api.adjustStock(itemId: item.id, AdjustStockBody(type: .input, quantity: 5, reason: "Received", locationId: shelf.id))
        #expect(item.onHand == 15)
        item = try await api.adjustStock(itemId: item.id, AdjustStockBody(type: .output, quantity: 3, reason: "Sold", locationId: shelf.id))
        #expect(item.onHand == 12)

        // Over-removal is refused with a readable 409
        do {
            _ = try await api.adjustStock(itemId: item.id, AdjustStockBody(type: .output, quantity: 99, reason: "Oops", locationId: shelf.id))
            Issue.record("Expected insufficient stock")
        } catch let error as APIError {
            #expect(error.kind == .conflict)
            #expect(error.message.contains("Insufficient stock"))
        }

        // Transfer
        item = try await api.transferStock(itemId: item.id, TransferStockBody(quantity: 4, fromLocationId: shelf.id, toLocationId: bin.id))
        #expect(item.onHand == 12)
        let byLocation = Dictionary(uniqueKeysWithValues: (item.locations ?? []).map { ($0.locationId, $0.quantity) })
        #expect(byLocation[shelf.id] == 8)
        #expect(byLocation[bin.id] == 4)

        // Scanning resolves the new barcode, including without its leading zeros
        let items = try await api.items(workspaceId: workspace.id)
        #expect(CodeMatcher.item(in: items, code: "99\(digits)")?.id == item.id)

        // Lot tracking: receive a lot, then pick from it
        item = try await api.updateItem(id: item.id, UpdateItemBody(locationIds: [shelf.id, bin.id], lotTracking: true))
        #expect(item.lotTracking)
        let lot = try await api.createLot(itemId: item.id, CreateLotBody(
            lotNumber: "L-\(suffix)", quantity: 6, expirationDate: "2030-01-15",
            locationAssignments: [.init(locationId: bin.id, quantity: 6)]
        ))
        #expect(lot.quantity == 6)
        #expect(lot.daysUntilExpiry ?? 0 > 0)
        let picked = try await api.adjustLot(id: lot.id, AdjustLotBody(type: .output, quantity: 2, locationId: bin.id))
        #expect(picked.quantity == 4)
        let lots = try await api.lots(itemId: item.id)
        #expect(lots.contains { $0.lotNumber == "EXISTING-STOCK" })
        #expect(try await api.item(id: item.id).onHand == 16)

        // Activity feed
        let feed = try await api.transactions(workspaceId: workspace.id, TransactionQuery(itemId: item.id, limit: 50))
        #expect(feed.transactions.contains { $0.type == .transfer && $0.quantity == 4 })
        #expect(feed.transactions.contains { $0.lot?.lotNumber == "L-\(suffix)" })

        // Dashboard reflects the item
        let summary = try await api.dashboard(workspaceId: workspace.id)
        #expect(summary.totalUnits >= 16)

        // Photos: upload, list, download through the session
        let jpeg = try #require(Self.sampleJPEG())
        let image = try await api.uploadImage(itemId: item.id, jpeg: jpeg, isPrimary: true)
        #expect(image.isPrimary)
        #expect(try await api.images(itemId: item.id).count == 1)
        let (bytes, response) = try await api.session.data(from: api.imageURL(id: image.id))
        #expect((response as? HTTPURLResponse)?.statusCode == 200)
        #expect(UIImage(data: bytes) != nil)

        // Clean up
        try await api.deleteItem(id: item.id)
        try await api.deleteLocation(id: shelf.id, workspaceId: workspace.id)
        try await api.deleteLocation(id: bin.id, workspaceId: workspace.id)
        await #expect(throws: APIError.self) { _ = try await api.item(id: item.id) }
    }

    @Test func badCredentialsAreRejected() async throws {
        let api = LiveServer.freshClient()
        do {
            try await api.login(email: "nobody-\(UUID().uuidString)@stockflow.test", password: "wrong-password")
            Issue.record("Expected login to fail")
        } catch let error as APIError {
            #expect(error.kind == .unauthorized)
        }
    }

    private static func sampleJPEG() -> Data? {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64))
        let image = renderer.image { context in
            UIColor.systemIndigo.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
        }
        return image.jpegData(compressionQuality: 0.8)
    }
}

enum LiveServer {
    static var url: URL? {
        ProcessInfo.processInfo.environment["STOCKFLOW_TEST_SERVER"].flatMap(Preferences.normalizedServerURL)
    }

    /// A client with its own cookie jar, so tests never touch the app's session.
    static func freshClient() -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        return APIClient(baseURL: url!, session: URLSession(configuration: config))
    }

    static func signedInClient() async throws -> APIClient {
        let api = freshClient()
        let env = ProcessInfo.processInfo.environment
        if let email = env["STOCKFLOW_TEST_EMAIL"], let password = env["STOCKFLOW_TEST_PASSWORD"] {
            try await api.login(email: email, password: password)
        } else {
            let id = UUID().uuidString.prefix(8).lowercased()
            try await api.register(RegisterBody(
                firstName: "iOS", lastName: "Test", email: "ios-\(id)@stockflow.test", password: "test-password-\(id)"
            ))
        }
        _ = try await api.profile()
        return api
    }
}
