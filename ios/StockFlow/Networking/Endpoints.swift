import Foundation

// Typed wrappers for every API route the app uses (server/routes/*.ts).

// MARK: - Request bodies

struct LoginBody: Encodable { let email: String; let password: String }

struct RegisterBody: Encodable {
    let firstName: String
    let lastName: String
    let email: String
    let password: String
}

struct CreateItemBody: Encodable {
    var workspaceId: String
    var name: String
    var barcode: String?
    var unit: String?
    var description: String?
    var onHand: Int?
    var cost: Double?
    var reorderPoint: Int?
    var categoryId: String?
    var supplierId: String?
    var locationIds: [String]?
}

struct UpdateItemBody: Encodable {
    var name: String?
    var barcode: String?
    var unit: String?
    var description: String?
    var cost: Double?
    var reorderPoint: Int?
    /// "" clears the category.
    var categoryId: String?
    /// "" clears the supplier.
    var supplierId: String?
    var locationIds: [String]?
    var lotTracking: Bool?
}

struct AdjustStockBody: Encodable {
    let type: StockDirection
    let quantity: Int
    let reason: String
    let locationId: String
}

struct TransferStockBody: Encodable {
    let quantity: Int
    let fromLocationId: String
    let toLocationId: String
    var lotId: String?
    var reason: String?
}

struct CreateLotBody: Encodable {
    struct Assignment: Encodable { let locationId: String; let quantity: Int }

    var lotNumber: String
    var quantity: Int
    /// "yyyy-MM-dd", like the web's date inputs.
    var manufactureDate: String?
    /// "yyyy-MM-dd", like the web's date inputs.
    var expirationDate: String?
    var supplierId: String?
    var poNumber: String?
    var notes: String?
    var locationAssignments: [Assignment]?
}

struct AdjustLotBody: Encodable {
    let type: StockDirection
    let quantity: Int
    let locationId: String
    var reason: String?
}

struct LocationBody: Encodable {
    struct Level: Encodable { let label: String; let value: String }

    var workspaceId: String
    var code: String
    var barcode: String?
    var structure: [Level]
    var capacity: Int?
    var description: String?
}

struct TransactionQuery {
    var itemId: String?
    var locationId: String?
    var lotId: String?
    var type: TransactionType?
    var limit: Int = 30
    var cursor: String?
}

// MARK: - Endpoints

extension APIClient {
    // Auth

    func login(email: String, password: String) async throws {
        try await send(.post, "/api/auth/login", body: LoginBody(email: email, password: password), notifyUnauthorized: false)
    }

    func register(_ body: RegisterBody) async throws {
        try await send(.post, "/api/auth/register", body: body, notifyUnauthorized: false)
    }

    func logout() async {
        _ = try? await send(.post, "/api/auth/logout", notifyUnauthorized: false)
    }

    func profile() async throws -> User {
        let data = try await perform(.get, "/api/auth/profile", notifyUnauthorized: false)
        struct Envelope: Decodable { let data: UserPayload }
        return try JSON.decoder.decode(Envelope.self, from: data).data.user
    }

    func updateProfile(name: String) async throws -> User {
        struct Body: Encodable { let name: String }
        return try await request(.patch, "/api/auth/profile", body: Body(name: name), as: UserPayload.self).user
    }

    @discardableResult
    func requestPasswordReset(email: String) async throws -> String? {
        struct Body: Encodable { let email: String }
        return try await send(.post, "/api/auth/password-change-request", body: Body(email: email), notifyUnauthorized: false)
    }

    func alive() async -> Bool {
        (try? await perform(.get, "/api/alive", notifyUnauthorized: false)) != nil
    }

    // Workspaces

    func workspaces() async throws -> [Workspace] {
        try await request(.get, "/api/workspaces", as: WorkspacesPayload.self).workspaces
    }

    func createWorkspace(name: String) async throws -> Workspace {
        struct Body: Encodable { let name: String }
        return try await request(.post, "/api/workspaces", body: Body(name: name), as: WorkspacePayload.self).workspace
    }

    // Dashboard & analytics

    func dashboard(workspaceId: String) async throws -> DashboardSummary {
        try await request(.get, "/api/dashboard/summary", query: ["workspaceId": workspaceId])
    }

    func analytics(workspaceId: String, timeRange: String = "30days") async throws -> Analytics {
        try await request(.get, "/api/analytics", query: ["workspaceId": workspaceId, "timeRange": timeRange])
    }

    // Items

    func items(workspaceId: String) async throws -> [Item] {
        var all: [Item] = []
        var cursor: String?
        repeat {
            let page = try await request(
                .get, "/api/items",
                query: ["workspaceId": workspaceId, "limit": "1000", "cursor": cursor],
                as: ItemsPage.self
            )
            all.append(contentsOf: page.items)
            cursor = page.nextCursor
        } while cursor != nil
        return all
    }

    func item(id: String) async throws -> Item {
        try await request(.get, "/api/items/\(id)", as: ItemPayload.self).item
    }

    func createItem(_ body: CreateItemBody) async throws -> Item {
        try await request(.post, "/api/items", body: body, as: ItemPayload.self).item
    }

    func updateItem(id: String, _ body: UpdateItemBody) async throws -> Item {
        try await request(.patch, "/api/items/\(id)", body: body, as: ItemPayload.self).item
    }

    func deleteItem(id: String) async throws {
        try await send(.delete, "/api/items/\(id)")
    }

    func adjustStock(itemId: String, _ body: AdjustStockBody) async throws -> Item {
        try await request(.post, "/api/items/\(itemId)/adjust-stock", body: body, as: ItemPayload.self).item
    }

    func transferStock(itemId: String, _ body: TransferStockBody) async throws -> Item {
        try await request(.post, "/api/items/\(itemId)/transfer-stock", body: body, as: ItemPayload.self).item
    }

    // Item images

    func images(itemId: String) async throws -> [ItemImage] {
        try await request(.get, "/api/items/images/\(itemId)", as: ImagesPayload.self).images
    }

    func imageURL(id: String) -> URL {
        url("/api/items/images/image/\(id)")
    }

    func uploadImage(itemId: String, jpeg: Data, isPrimary: Bool) async throws -> ItemImage {
        try await upload(
            "/api/items/images/\(itemId)",
            fileField: "image",
            fileName: "photo.jpg",
            mimeType: "image/jpeg",
            fileData: jpeg,
            fields: ["isPrimary": isPrimary ? "true" : "false"],
            as: ImagePayload.self
        ).image
    }

    func setPrimaryImage(id: String) async throws {
        try await send(.patch, "/api/items/images/\(id)/primary")
    }

    func deleteImage(id: String) async throws {
        try await send(.delete, "/api/items/images/\(id)")
    }

    // Lots

    func lots(itemId: String) async throws -> [Lot] {
        try await request(.get, "/api/lots/item/\(itemId)", as: LotsPayload.self).lots
    }

    func lot(id: String) async throws -> Lot {
        try await request(.get, "/api/lots/\(id)", as: LotPayload.self).lot
    }

    func createLot(itemId: String, _ body: CreateLotBody) async throws -> Lot {
        try await request(.post, "/api/lots/item/\(itemId)", body: body, as: LotPayload.self).lot
    }

    func adjustLot(id: String, _ body: AdjustLotBody) async throws -> Lot {
        try await request(.post, "/api/lots/\(id)/adjust", body: body, as: LotPayload.self).lot
    }

    func updateLotStatus(id: String, status: LotStatus) async throws -> Lot {
        struct Body: Encodable { let status: LotStatus }
        return try await request(.patch, "/api/lots/\(id)/status", body: Body(status: status), as: LotPayload.self).lot
    }

    func expiringLots(workspaceId: String, days: Int = 30) async throws -> [Lot] {
        try await request(
            .get, "/api/lots/expiring",
            query: ["workspaceId": workspaceId, "days": String(days)],
            as: LotsPayload.self
        ).lots
    }

    // Locations

    func locations(workspaceId: String) async throws -> [Location] {
        try await request(.get, "/api/locations", query: ["workspaceId": workspaceId], as: LocationsPayload.self).locations
    }

    func location(id: String, workspaceId: String) async throws -> Location {
        try await request(.get, "/api/locations/\(id)", query: ["workspaceId": workspaceId], as: LocationPayload.self).location
    }

    func createLocation(_ body: LocationBody) async throws -> Location {
        try await request(.post, "/api/locations", body: body, as: LocationPayload.self).location
    }

    func updateLocation(id: String, _ body: LocationBody) async throws -> Location {
        try await request(.patch, "/api/locations/\(id)", body: body, as: LocationPayload.self).location
    }

    func deleteLocation(id: String, workspaceId: String) async throws {
        try await send(.delete, "/api/locations/\(id)", query: ["workspaceId": workspaceId])
    }

    func locationTemplate(workspaceId: String) async throws -> StructureTemplate? {
        try await request(
            .get, "/api/locations/workspace-structure",
            query: ["workspaceId": workspaceId],
            as: StructurePayload.self
        ).structure
    }

    // Categories & suppliers

    func categories(workspaceId: String) async throws -> [Category] {
        try await request(.get, "/api/categories", query: ["workspaceId": workspaceId], as: CategoriesPayload.self).categories
    }

    func createCategory(workspaceId: String, name: String) async throws -> Category {
        struct Body: Encodable { let workspaceId: String; let name: String }
        return try await request(
            .post, "/api/categories",
            body: Body(workspaceId: workspaceId, name: name),
            as: CategoryPayload.self
        ).category
    }

    func suppliers(workspaceId: String) async throws -> [Supplier] {
        try await request(.get, "/api/suppliers", query: ["workspaceId": workspaceId], as: SuppliersPayload.self).suppliers
    }

    func createSupplier(workspaceId: String, name: String) async throws -> Supplier {
        struct Body: Encodable { let workspaceId: String; let name: String }
        return try await request(
            .post, "/api/suppliers",
            body: Body(workspaceId: workspaceId, name: name),
            as: SupplierPayload.self
        ).supplier
    }

    // Activity

    func transactions(workspaceId: String, _ query: TransactionQuery) async throws -> TransactionsPage {
        try await request(
            .get, "/api/transactions",
            query: [
                "workspaceId": workspaceId,
                "itemId": query.itemId,
                "locationId": query.locationId,
                "lotId": query.lotId,
                "type": query.type?.rawValue,
                "limit": String(query.limit),
                "cursor": query.cursor,
            ],
            as: TransactionsPage.self
        )
    }
}
