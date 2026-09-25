import SwiftUI

/// Device-local settings (UserDefaults).
enum Preferences {
    static let serverURLKey = "serverURL"
    static let workspaceIdKey = "selectedWorkspaceId"
    static let lastEmailKey = "lastEmail"
    static let appearanceKey = "appearance"
    static let scanHapticsKey = "scanHaptics"
    static let scanSoundKey = "scanSound"
    static let inventorySortKey = "inventorySort"
    static let developerModeKey = "developerMode"
    static let recentServersKey = "recentServers"

    /// Servers used before, most recent first (for the developer server switcher).
    static var recentServers: [String] {
        UserDefaults.standard.stringArray(forKey: recentServersKey) ?? []
    }

    static func remember(server url: URL) {
        let value = url.absoluteString
        let list = [value] + recentServers.filter { $0 != value }
        UserDefaults.standard.set(Array(list.prefix(6)), forKey: recentServersKey)
    }

    /// False until a server has been used or one is baked into the build.
    static var hasConfiguredServer: Bool {
        normalizedServerURL(initialServerURL) != nil
    }

    /// The server the sign-in screen starts with: last used, else the build's default.
    static var initialServerURL: String {
        if let saved = UserDefaults.standard.string(forKey: serverURLKey), !saved.isEmpty { return saved }
        let bundled = Bundle.main.object(forInfoDictionaryKey: "StockFlowDefaultServerURL") as? String ?? ""
        return bundled.isEmpty || bundled.hasPrefix("$(") ? "https://" : bundled
    }

    /// Turns what the user typed ("inventory.acme.com", "192.168.1.20:5001") into a URL.
    static func normalizedServerURL(_ raw: String) -> URL? {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, text != "https://", text != "http://" else { return nil }
        if !text.contains("://") {
            let isLocal = text.hasPrefix("localhost") || text.hasPrefix("127.") || text.hasPrefix("192.168.")
                || text.hasPrefix("10.") || text.contains(".local")
            text = (isLocal ? "http://" : "https://") + text
        }
        while text.hasSuffix("/") { text.removeLast() }
        if text.hasSuffix("/api") { text.removeLast(4) }
        guard let url = URL(string: text), let scheme = url.scheme, ["http", "https"].contains(scheme), url.host != nil else {
            return nil
        }
        return url
    }
}

enum AppearanceMode: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: "Automatic"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}
