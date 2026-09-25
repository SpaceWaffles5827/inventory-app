import Foundation
import Observation

/// Session state: which server, who is signed in, and which workspace is active.
@MainActor
@Observable
final class AppModel {
    enum Phase: Equatable {
        case launching
        case signedOut
        case signedIn
        /// We have a session cookie but the server can't be reached right now.
        case unreachable(String)
    }

    private(set) var phase: Phase = .launching
    private(set) var api: APIClient
    private(set) var user: User?
    private(set) var workspaces: [Workspace] = []
    private(set) var workspace: Workspace?
    private(set) var store: InventoryStore?
    /// Shown on the sign-in screen after an automatic sign-out.
    var signedOutReason: String?

    init() {
        let url = Preferences.normalizedServerURL(Preferences.initialServerURL) ?? URL(string: "http://localhost:5001")!
        api = APIClient(baseURL: url)
        wireUnauthorizedHandler()
    }

    var serverURL: URL { api.baseURL }
    var role: Role { workspace?.role ?? .member }
    var canDelete: Bool { role >= .admin }
    var canManageSettings: Bool { role >= .admin }

    // MARK: Launch

    func bootstrap() async {
        guard phase == .launching else { return }
        guard api.hasSessionCookie else {
            phase = .signedOut
            return
        }
        do {
            try await loadSession()
        } catch let error as APIError where error.kind == .unauthorized {
            phase = .signedOut
        } catch {
            // Offline or server down: keep the session and offer a retry
            // instead of throwing the user out.
            phase = .unreachable(error.localizedDescription)
        }
    }

    func retryLaunch() async {
        phase = .launching
        await bootstrap()
    }

    // MARK: Auth

    func signIn(server: URL, email: String, password: String) async throws {
        useServer(server)
        try await api.login(email: email, password: password)
        UserDefaults.standard.set(email, forKey: Preferences.lastEmailKey)
        try await loadSession()
    }

    func signUp(server: URL, body: RegisterBody) async throws {
        useServer(server)
        try await api.register(body)
        UserDefaults.standard.set(body.email, forKey: Preferences.lastEmailKey)
        do {
            try await loadSession()
        } catch let error as APIError where error.kind == .unauthorized {
            // Registration succeeded but auto-login didn't; sign in explicitly.
            try await api.login(email: body.email, password: body.password)
            try await loadSession()
        }
    }

    func signOut(reason: String? = nil) async {
        if reason == nil { await api.logout() }
        api.clearCookies()
        user = nil
        workspaces = []
        workspace = nil
        store = nil
        signedOutReason = reason
        phase = .signedOut
    }

    func updateName(_ name: String) async throws {
        user = try await api.updateProfile(name: name)
    }

    private func useServer(_ url: URL) {
        UserDefaults.standard.set(url.absoluteString, forKey: Preferences.serverURLKey)
        guard url != api.baseURL else { return }
        api = APIClient(baseURL: url)
        wireUnauthorizedHandler()
    }

    private func wireUnauthorizedHandler() {
        api.onUnauthorized = { [weak self] in
            Task { @MainActor in
                guard let self, self.phase == .signedIn else { return }
                await self.signOut(reason: "Your session expired. Please sign in again.")
            }
        }
    }

    private func loadSession() async throws {
        user = try await api.profile()
        try await reloadWorkspaces()
        signedOutReason = nil
        phase = .signedIn
    }

    // MARK: Workspaces

    func reloadWorkspaces() async throws {
        workspaces = try await api.workspaces()
        let savedId = UserDefaults.standard.string(forKey: Preferences.workspaceIdKey)
        let current = workspace.flatMap { ws in workspaces.first { $0.id == ws.id } }
            ?? workspaces.first { $0.id == savedId }
            ?? workspaces.first
        if let current {
            select(current)
        } else {
            workspace = nil
            store = nil
        }
    }

    func select(_ newWorkspace: Workspace) {
        let changed = newWorkspace.id != workspace?.id
        workspace = newWorkspace
        UserDefaults.standard.set(newWorkspace.id, forKey: Preferences.workspaceIdKey)
        if changed || store == nil {
            store = InventoryStore(api: api, workspaceId: newWorkspace.id)
        }
    }

    func createWorkspace(named name: String) async throws {
        let created = try await api.createWorkspace(name: name)
        try await reloadWorkspaces()
        if let match = workspaces.first(where: { $0.id == created.id }) { select(match) }
    }
}
