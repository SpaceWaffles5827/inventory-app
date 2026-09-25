import SwiftUI
import UIKit

@main
struct StockFlowApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model = AppModel()
    @State private var router = Router()
    @AppStorage(Preferences.appearanceKey) private var appearance = AppearanceMode.system.rawValue

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(router)
                .preferredColorScheme(AppearanceMode(rawValue: appearance)?.colorScheme)
                .onOpenURL { router.handle(url: $0) }
                .onReceive(NotificationCenter.default.publisher(for: .quickActionTriggered)) { note in
                    if let type = note.object as? String { router.handleShortcut(type) }
                }
                .task {
                    // A quick action that cold-launched the app.
                    if let type = QuickActions.takePending() { router.handleShortcut(type) }
                }
        }
    }
}

extension Notification.Name {
    static let quickActionTriggered = Notification.Name("StockFlowQuickActionTriggered")
}

/// Home-screen quick actions arrive through the UIKit delegates.
enum QuickActions {
    @MainActor private static var pending: String?

    @MainActor static func store(_ type: String) { pending = type }

    @MainActor static func takePending() -> String? {
        defer { pending = nil }
        return pending
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        if let shortcut = options.shortcutItem {
            MainActor.assumeIsolated { QuickActions.store(shortcut.type) }
        }
        let configuration = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }
}

final class SceneDelegate: NSObject, UIWindowSceneDelegate {
    func windowScene(
        _ windowScene: UIWindowScene,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {
        NotificationCenter.default.post(name: .quickActionTriggered, object: shortcutItem.type)
        completionHandler(true)
    }
}
