import SwiftUI

struct MainTabView: View {
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store

    var body: some View {
        @Bindable var router = router

        TabView(selection: tabSelection) {
            Tab("Overview", systemImage: "square.grid.2x2.fill", value: AppTab.overview) {
                OverviewView()
            }
            Tab("Inventory", systemImage: "shippingbox.fill", value: AppTab.inventory) {
                InventoryView()
            }
            Tab("Scan", systemImage: "barcode.viewfinder", value: AppTab.scan) {
                ScanView()
            }
            Tab("Locations", systemImage: "mappin.and.ellipse", value: AppTab.locations) {
                LocationsView()
            }
            Tab("Activity", systemImage: "clock.arrow.circlepath", value: AppTab.activity) {
                ActivityView()
            }
        }
        .minimizingTabBarOnScroll()
        .sheet(item: $router.sheet) { sheet in
            switch sheet {
            case .settings:
                SettingsView()
            case .newItem(let barcode):
                ItemFormView(mode: .create(barcode: barcode)) { item in
                    router.sheet = nil
                    router.showItem(item.id)
                }
            case .item(let id):
                NavigationStack {
                    ItemDetailView(itemId: id)
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) {
                                Button("Done") { router.sheet = nil }
                            }
                        }
                        .appDestinations()
                }
            case .location(let id):
                NavigationStack {
                    LocationDetailView(locationId: id)
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) {
                                Button("Done") { router.sheet = nil }
                            }
                        }
                        .appDestinations()
                }
            }
        }
        .task { await store.ensureLoaded() }
    }

    /// Selecting the current tab again pops it to its root.
    private var tabSelection: Binding<AppTab> {
        Binding(
            get: { router.tab },
            set: { newValue in
                if newValue == router.tab {
                    withAnimation { router.popToRoot(newValue) }
                } else {
                    router.tab = newValue
                }
            }
        )
    }
}

extension View {
    /// Shared push destinations for every navigation stack.
    func appDestinations() -> some View {
        navigationDestination(for: ItemRoute.self) { ItemDetailView(itemId: $0.id) }
            .navigationDestination(for: LocationRoute.self) { LocationDetailView(locationId: $0.id) }
            .navigationDestination(for: LotRoute.self) { LotDetailView(lotId: $0.id) }
    }

    @ViewBuilder
    func minimizingTabBarOnScroll() -> some View {
        if #available(iOS 26.0, *) {
            tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }
}
