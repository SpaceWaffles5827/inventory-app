import Foundation

enum HTTPMethod: String {
    case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE"
}

/// A failed API call, with a message that is safe to show to the user.
struct APIError: LocalizedError, Equatable {
    enum Kind: Equatable {
        case offline, unauthorized, forbidden, notFound, badRequest, conflict, server, decoding, invalidServer
    }

    let kind: Kind
    let status: Int
    let message: String

    var errorDescription: String? { message }

    static func from(status: Int, message: String?) -> APIError {
        let kind: Kind
        switch status {
        case 401: kind = .unauthorized
        case 403: kind = .forbidden
        case 404: kind = .notFound
        case 409: kind = .conflict
        case 400..<500: kind = .badRequest
        default: kind = .server
        }
        let fallback: String
        switch kind {
        case .unauthorized: fallback = "Your session has expired. Please sign in again."
        case .forbidden: fallback = "You don't have permission to do that."
        case .notFound: fallback = "That record no longer exists."
        case .server: fallback = "The server hit an error. Please try again."
        default: fallback = "Something went wrong."
        }
        let text = (message?.isEmpty == false) ? message! : fallback
        return APIError(kind: kind, status: status, message: text)
    }
}

/// Talks to the StockFlow Express API. Authentication rides on the same
/// `inventory.sid` session cookie the web app uses, kept in the shared cookie store.
final class APIClient: @unchecked Sendable {
    let baseURL: URL
    let session: URLSession
    /// Called (on any thread) when an authenticated request comes back 401.
    var onUnauthorized: (@Sendable () -> Void)?

    init(baseURL: URL, session: URLSession = APIClient.makeSession()) {
        self.baseURL = baseURL
        self.session = session
    }

    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 20
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }

    // MARK: URLs

    func url(_ path: String, query: [String: String?] = [:]) -> URL {
        var base = baseURL.absoluteString
        while base.hasSuffix("/") { base.removeLast() }
        var components = URLComponents(string: base + path)!
        let items = query
            .compactMap { key, value -> URLQueryItem? in
                guard let value, !value.isEmpty else { return nil }
                return URLQueryItem(name: key, value: value)
            }
            .sorted { $0.name < $1.name }
        if !items.isEmpty { components.queryItems = items }
        return components.url!
    }

    // MARK: Requests

    /// Sends a request and decodes the `data` field of the `{ status, message, data }` envelope.
    func request<T: Decodable>(
        _ method: HTTPMethod = .get,
        _ path: String,
        query: [String: String?] = [:],
        body: (any Encodable)? = nil,
        as type: T.Type = T.self
    ) async throws -> T {
        let data = try await perform(method, path, query: query, body: body)
        do {
            return try JSON.decoder.decode(Envelope<T>.self, from: data).data
        } catch {
            #if DEBUG
            print("⚠️ Decoding \(T.self) from \(path) failed: \(error)")
            #endif
            throw APIError(kind: .decoding, status: 200, message: "The server sent a response this app doesn't understand. Is the server up to date?")
        }
    }

    /// Sends a request whose response body we only need for its `message`.
    @discardableResult
    func send(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?] = [:],
        body: (any Encodable)? = nil,
        notifyUnauthorized: Bool = true
    ) async throws -> String? {
        let data = try await perform(method, path, query: query, body: body, notifyUnauthorized: notifyUnauthorized)
        return (try? JSON.decoder.decode(MessageBody.self, from: data))?.message
    }

    func perform(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?] = [:],
        body: (any Encodable)? = nil,
        notifyUnauthorized: Bool = true
    ) async throws -> Data {
        var request = URLRequest(url: url(path, query: query))
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSON.encoder.encode(body)
        }
        return try await execute(request, notifyUnauthorized: notifyUnauthorized)
    }

    func execute(_ request: URLRequest, notifyUnauthorized: Bool = true) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .unsupportedURL || error.code == .badURL {
            throw APIError(kind: .invalidServer, status: 0, message: "That server address isn't valid.")
        } catch {
            throw APIError(kind: .offline, status: 0, message: "Can't reach the server. Check your connection and try again.")
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError(kind: .server, status: 0, message: "Unexpected response from the server.")
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = try? JSON.decoder.decode(MessageBody.self, from: data)
            let error = APIError.from(status: http.statusCode, message: body?.message ?? body?.error)
            if http.statusCode == 401, notifyUnauthorized { onUnauthorized?() }
            throw error
        }
        return data
    }

    // MARK: Uploads

    func upload<T: Decodable>(
        _ path: String,
        fileField: String,
        fileName: String,
        mimeType: String,
        fileData: Data,
        fields: [String: String] = [:],
        as type: T.Type = T.self
    ) async throws -> T {
        let boundary = "StockFlow-\(UUID().uuidString)"
        var body = Data()
        func append(_ string: String) { body.append(Data(string.utf8)) }
        for (name, value) in fields {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
            append("\(value)\r\n")
        }
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"\(fileField)\"; filename=\"\(fileName)\"\r\n")
        append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        append("\r\n--\(boundary)--\r\n")

        var request = URLRequest(url: url(path))
        request.httpMethod = "POST"
        request.timeoutInterval = 90
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        let data = try await execute(request)
        do {
            return try JSON.decoder.decode(Envelope<T>.self, from: data).data
        } catch {
            throw APIError(kind: .decoding, status: 200, message: "The server sent a response this app doesn't understand.")
        }
    }

    // MARK: Cookies

    /// Forget the session cookie for this server (after sign-out).
    func clearCookies() {
        let storage = HTTPCookieStorage.shared
        for cookie in storage.cookies(for: baseURL) ?? [] {
            storage.deleteCookie(cookie)
        }
    }

    var hasSessionCookie: Bool {
        (HTTPCookieStorage.shared.cookies(for: baseURL) ?? []).contains { $0.name == "inventory.sid" }
    }
}

private struct Envelope<T: Decodable>: Decodable {
    let data: T
}

private struct MessageBody: Decodable {
    let message: String?
    let error: String?
}
