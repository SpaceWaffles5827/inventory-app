import Foundation
import Testing
@testable import StockFlow

/// Serves canned responses so the client can be tested without a server.
final class StubProtocol: URLProtocol, @unchecked Sendable {
    struct Response {
        var status: Int
        var body: String
    }

    nonisolated(unsafe) static var handler: ((URLRequest) -> Response)?
    nonisolated(unsafe) static var lastRequest: URLRequest?
    nonisolated(unsafe) static var lastBody: Data?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lastRequest = request
        Self.lastBody = request.httpBody ?? request.httpBodyStream.map(Self.read)
        let response = Self.handler?(request) ?? Response(status: 500, body: "")
        let http = HTTPURLResponse(url: request.url!, statusCode: response.status, httpVersion: "HTTP/1.1",
                                   headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(response.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func read(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }

    static func client(baseURL: String = "https://stock.example.com") -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return APIClient(baseURL: URL(string: baseURL)!, session: URLSession(configuration: config))
    }
}

@Suite(.serialized)
struct APIClientTests {
    @Test func buildsURLsWithSortedQueryAndSkipsEmptyValues() {
        let client = StubProtocol.client(baseURL: "https://stock.example.com/")
        let url = client.url("/api/items", query: ["workspaceId": "ws1", "cursor": nil, "limit": "", "a": "1"])
        #expect(url.absoluteString == "https://stock.example.com/api/items?a=1&workspaceId=ws1")
    }

    @Test func keepsBasePathForReverseProxies() {
        let client = StubProtocol.client(baseURL: "https://example.com/inventory")
        #expect(client.url("/api/alive").absoluteString == "https://example.com/inventory/api/alive")
    }

    @Test func decodesEnvelopeData() async throws {
        StubProtocol.handler = { _ in
            .init(status: 200, body: #"{"status":"success","data":{"user":{"id":"u1","email":"a@b.co","name":"Ann Lee"}}}"#)
        }
        let user = try await StubProtocol.client().request(.get, "/api/auth/profile", as: UserPayload.self).user
        #expect(user.initials == "AL")
    }

    @Test func surfacesServerValidationMessage() async {
        StubProtocol.handler = { _ in
            .init(status: 400, body: #"{"status":"error","message":"Quantity must be a positive whole number","error":"Quantity must be a positive whole number"}"#)
        }
        await #expect(throws: APIError(kind: .badRequest, status: 400, message: "Quantity must be a positive whole number")) {
            _ = try await StubProtocol.client().adjustStock(
                itemId: "i1",
                AdjustStockBody(type: .input, quantity: 0, reason: "x", locationId: "l1")
            )
        }
    }

    @Test func conflictKeepsMessage() async {
        StubProtocol.handler = { _ in
            .init(status: 409, body: #"{"status":"error","message":"Insufficient stock: tried to remove 5 but only 2 available at this location"}"#)
        }
        do {
            _ = try await StubProtocol.client().adjustStock(
                itemId: "i1",
                AdjustStockBody(type: .output, quantity: 5, reason: "x", locationId: "l1")
            )
            Issue.record("Expected an error")
        } catch let error as APIError {
            #expect(error.kind == .conflict)
            #expect(error.message.contains("only 2 available"))
        } catch {
            Issue.record("Unexpected error \(error)")
        }
    }

    @Test func nonJSONErrorPageFallsBackToFriendlyMessage() async {
        StubProtocol.handler = { _ in .init(status: 502, body: "<html>Bad gateway</html>") }
        do {
            _ = try await StubProtocol.client().workspaces()
            Issue.record("Expected an error")
        } catch let error as APIError {
            #expect(error.kind == .server)
            #expect(error.message == "The server hit an error. Please try again.")
        } catch {
            Issue.record("Unexpected error \(error)")
        }
    }

    @Test func unauthorizedNotifiesSession() async {
        StubProtocol.handler = { _ in .init(status: 401, body: #"{"status":"error","message":"Unauthorized"}"#) }
        let client = StubProtocol.client()
        let flag = Flag()
        client.onUnauthorized = { flag.set() }
        _ = try? await client.workspaces()
        #expect(flag.value)
    }

    @Test func loginFailureDoesNotTriggerSessionExpiry() async {
        StubProtocol.handler = { _ in .init(status: 401, body: #"{"status":"error","message":"Incorrect username or password."}"#) }
        let client = StubProtocol.client()
        let flag = Flag()
        client.onUnauthorized = { flag.set() }
        await #expect(throws: APIError.self) { try await client.login(email: "a@b.co", password: "nope") }
        #expect(!flag.value)
    }

    @Test func encodesAdjustBodyLikeTheWebClient() async throws {
        StubProtocol.handler = { _ in .init(status: 500, body: "") }
        _ = try? await StubProtocol.client().adjustStock(
            itemId: "item-1",
            AdjustStockBody(type: .output, quantity: 3, reason: "Sold", locationId: "loc-1")
        )
        let request = try #require(StubProtocol.lastRequest)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.path == "/api/items/item-1/adjust-stock")
        let body = try #require(StubProtocol.lastBody)
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["type"] as? String == "OUTPUT")
        #expect(json["quantity"] as? Int == 3)
        #expect(json["locationId"] as? String == "loc-1")
    }

    @Test func lotBodySendsCalendarDays() throws {
        let body = CreateLotBody(lotNumber: "L1", quantity: 2, expirationDate: "2027-03-24")
        let json = try #require(try JSONSerialization.jsonObject(with: JSON.encoder.encode(body)) as? [String: Any])
        #expect(json["expirationDate"] as? String == "2027-03-24")
        #expect(json["manufactureDate"] == nil)
    }
}

final class Flag: @unchecked Sendable {
    private let lock = NSLock()
    private var _value = false
    var value: Bool { lock.withLock { _value } }
    func set() { lock.withLock { _value = true } }
}
