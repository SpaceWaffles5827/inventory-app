import SwiftUI

enum InventoryFilter: String, CaseIterable, Identifiable {
    case all, needsAttention, lowStock, outOfStock, inStock
    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: "All"
        case .needsAttention: "Needs attention"
        case .lowStock: "Low stock"
        case .outOfStock: "Out of stock"
        case .inStock: "In stock"
        }
    }

    func matches(_ item: Item) -> Bool {
        let status = ItemStatus.derive(onHand: item.onHand, reorderPoint: item.reorderPoint)
        switch self {
        case .all: return true
        case .needsAttention: return status != .inStock
        case .lowStock: return status == .lowStock
        case .outOfStock: return status == .outOfStock
        case .inStock: return status == .inStock
        }
    }
}

enum InventorySort: String, CaseIterable, Identifiable {
    case name, stockLow, stockHigh, value, recent
    var id: String { rawValue }

    var title: String {
        switch self {
        case .name: "Name"
        case .stockLow: "Lowest stock"
        case .stockHigh: "Highest stock"
        case .value: "Stock value"
        case .recent: "Recently updated"
        }
    }

    var symbol: String {
        switch self {
        case .name: "textformat"
        case .stockLow: "arrow.down.right"
        case .stockHigh: "arrow.up.right"
        case .value: "dollarsign.circle"
        case .recent: "clock"
        }
    }

    func sort(_ items: [Item]) -> [Item] {
        switch self {
        case .name: items.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        case .stockLow: items.sorted { ($0.onHand, $0.name) < ($1.onHand, $1.name) }
        case .stockHigh: items.sorted { ($0.onHand, $1.name) > ($1.onHand, $0.name) }
        case .value: items.sorted { $0.value > $1.value }
        case .recent: items.sorted { $0.updatedAt > $1.updatedAt }
        }
    }
}

struct InventoryView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store

    @State private var search = ""
    @State private var filter: InventoryFilter = .all
    @State private var categoryId: String?
    @AppStorage(Preferences.inventorySortKey) private var sortRaw = InventorySort.name.rawValue
    @State private var stockAction: StockAction?
    @State private var toast: Toast?
    @State private var error: String?

    private var sort: InventorySort { InventorySort(rawValue: sortRaw) ?? .name }

    private var visibleItems: [Item] {
        let query = search.trimmingCharacters(in: .whitespaces)
        let filtered = store.items.filter { item in
            guard filter.matches(item) else { return false }
            if let categoryId, item.categoryId != categoryId { return false }
            guard !query.isEmpty else { return true }
            return item.name.localizedCaseInsensitiveContains(query)
                || item.itemNumber.localizedCaseInsensitiveContains(query)
                || (item.barcode?.localizedCaseInsensitiveContains(query) ?? false)
                || (item.category?.name.localizedCaseInsensitiveContains(query) ?? false)
                || (item.supplier?.name.localizedCaseInsensitiveContains(query) ?? false)
        }
        return sort.sort(filtered)
    }

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.inventoryPath) {
            List {
                Section {
                    FilterChips(filter: $filter, categoryId: $categoryId)
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 8, trailing: 0))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }

                if let error, store.items.isEmpty {
                    ErrorBanner(message: error) { Task { await refresh() } }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section {
                    ForEach(visibleItems) { item in
                        NavigationLink(value: ItemRoute(id: item.id)) {
                            ItemRow(item: item)
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button {
                                stockAction = .adjust(item, .input)
                            } label: {
                                Label("Add", systemImage: "plus")
                            }
                            .tint(.green)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button {
                                stockAction = .adjust(item, .output)
                            } label: {
                                Label("Remove", systemImage: "minus")
                            }
                            .tint(.red)
                            Button {
                                stockAction = .transfer(item)
                            } label: {
                                Label("Move", systemImage: "arrow.left.arrow.right")
                            }
                            .tint(.blue)
                        }
                        .contextMenu {
                            ItemQuickActions(item: item, action: $stockAction)
                        } preview: {
                            ItemPreviewCard(item: item)
                        }
                    }
                } header: {
                    if store.hasLoadedItems {
                        Text("\(visibleItems.count) \(visibleItems.count == 1 ? "item" : "items")")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .animation(.snappy, value: filter)
            .animation(.snappy, value: categoryId)
            .overlay { emptyState }
            .navigationTitle("Inventory")
            .searchable(text: $search, prompt: "Name, SKU or barcode")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        Picker("Sort by", selection: $sortRaw) {
                            ForEach(InventorySort.allCases) { option in
                                Label(option.title, systemImage: option.symbol).tag(option.rawValue)
                            }
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                    }
                    .accessibilityLabel("Sort")

                    Button {
                        router.sheet = .newItem(barcode: nil)
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("New item")
                }
            }
            .refreshable { await refresh() }
            .stockActionSheet($stockAction) { message in
                toast = Toast(message: message)
            }
            .toast($toast)
            .onAppear(perform: applyRequestedFilter)
            .onChange(of: router.requestedInventoryFilter) { _, _ in applyRequestedFilter() }
            .appDestinations()
        }
    }

    @ViewBuilder private var emptyState: some View {
        if !store.hasLoadedItems && error == nil {
            ProgressView("Loading inventory…")
        } else if store.items.isEmpty && store.hasLoadedItems {
            ContentUnavailableView {
                Label("No Items Yet", systemImage: "shippingbox")
            } description: {
                Text("Add your first item, or scan a product barcode to create one.")
            } actions: {
                Button("New Item") { router.sheet = .newItem(barcode: nil) }
                    .buttonStyle(.borderedProminent)
                Button("Scan a Barcode") { router.openScanner(mode: .find) }
            }
        } else if visibleItems.isEmpty && !search.isEmpty {
            ContentUnavailableView.search(text: search)
        } else if visibleItems.isEmpty {
            ContentUnavailableView(
                "Nothing Here",
                systemImage: "line.3.horizontal.decrease.circle",
                description: Text("No items match this filter.")
            )
        }
    }

    private func applyRequestedFilter() {
        guard let requested = router.requestedInventoryFilter else { return }
        filter = requested
        categoryId = nil
        router.requestedInventoryFilter = nil
        router.inventoryPath = NavigationPath()
    }

    private func refresh() async {
        do {
            try await store.refreshItems()
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
        try? await store.refreshReferenceData()
    }
}

// MARK: - Row

struct ItemRow: View {
    let item: Item

    private var status: ItemStatus { .derive(onHand: item.onHand, reorderPoint: item.reorderPoint) }

    var body: some View {
        HStack(spacing: 12) {
            ItemThumbnail(itemId: item.id, name: item.name, size: 48)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name)
                    .font(.body.weight(.semibold))
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(item.itemNumber)
                        .font(.caption.monospaced())
                    if let category = item.category?.name {
                        Text("·")
                        Text(category)
                    }
                    if item.lotTracking {
                        Image(systemName: "number.square")
                            .accessibilityLabel("Lot tracked")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                Text(Format.number(item.onHand))
                    .font(.title3.weight(.bold))
                    .fontDesign(.rounded)
                    .monospacedDigit()
                    .foregroundStyle(status == .inStock ? Color.primary : status.color)
                    .contentTransition(.numericText(value: Double(item.onHand)))
                HStack(spacing: 4) {
                    Circle().fill(status.color).frame(width: 6, height: 6)
                    Text(item.unitLabel)
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityValue("\(item.onHand) \(item.unitLabel), \(status.title)")
    }
}

private struct FilterChips: View {
    @Environment(InventoryStore.self) private var store
    @Binding var filter: InventoryFilter
    @Binding var categoryId: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach([InventoryFilter.all, .needsAttention, .outOfStock, .inStock]) { option in
                    chip(
                        title: option.title,
                        count: store.items.filter(option.matches).count,
                        selected: filter == option || (option == .needsAttention && filter == .lowStock)
                    ) {
                        filter = option
                    }
                }
                if !store.categories.isEmpty {
                    Divider().frame(height: 22)
                    Menu {
                        Button("All categories") { categoryId = nil }
                        ForEach(store.categories) { category in
                            Button(category.name) { categoryId = category.id }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "folder")
                            Text(store.categories.first { $0.id == categoryId }?.name ?? "Category")
                            Image(systemName: "chevron.down").font(.caption2.weight(.bold))
                        }
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .foregroundStyle(categoryId == nil ? Color.primary : Color.white)
                        .background(categoryId == nil ? Color(.secondarySystemGroupedBackground) : Color.accentColor, in: .capsule)
                    }
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func chip(title: String, count: Int, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selection()
            action()
        } label: {
            HStack(spacing: 5) {
                Text(title)
                Text("\(count)")
                    .foregroundStyle(selected ? Color.white.opacity(0.8) : Color.secondary)
            }
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .foregroundStyle(selected ? Color.white : Color.primary)
            .background(selected ? Color.accentColor : Color(.secondarySystemGroupedBackground), in: .capsule)
        }
        .buttonStyle(.plain)
    }
}

/// Context-menu actions shared by lists and the scanner.
struct ItemQuickActions: View {
    let item: Item
    @Binding var action: StockAction?

    var body: some View {
        Button { action = .adjust(item, .input) } label: {
            Label("Add Stock", systemImage: "plus.circle")
        }
        Button { action = .adjust(item, .output) } label: {
            Label("Remove Stock", systemImage: "minus.circle")
        }
        Button { action = .transfer(item) } label: {
            Label("Move Stock", systemImage: "arrow.left.arrow.right.circle")
        }
        if item.lotTracking {
            Button { action = .receiveLot(item) } label: {
                Label("Receive Lot", systemImage: "shippingbox.and.arrow.backward")
            }
        }
        Divider()
        Button {
            UIPasteboard.general.string = item.barcode ?? item.itemNumber
        } label: {
            Label("Copy \(item.barcode == nil ? "Item Number" : "Barcode")", systemImage: "doc.on.doc")
        }
    }
}

struct ItemPreviewCard: View {
    let item: Item

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                ItemThumbnail(itemId: item.id, name: item.name, size: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name).font(.headline)
                    Text(item.itemNumber).font(.caption.monospaced()).foregroundStyle(.secondary)
                    StatusBadge(status: .derive(onHand: item.onHand, reorderPoint: item.reorderPoint), compact: true)
                }
            }
            HStack {
                VStack(alignment: .leading) {
                    Text(Format.number(item.onHand)).font(.title.bold()).fontDesign(.rounded)
                    Text("\(item.unitLabel) on hand").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text(Format.currency(item.value)).font(.title3.bold())
                    Text("value").font(.caption).foregroundStyle(.secondary)
                }
            }
            if !item.stockedLocations.isEmpty {
                Divider()
                ForEach(item.stockedLocations.prefix(4)) { location in
                    HStack {
                        Label(location.code, systemImage: "mappin")
                        Spacer()
                        Text(Format.number(location.quantity)).monospacedDigit()
                    }
                    .font(.subheadline)
                }
            }
        }
        .padding(20)
        .frame(width: 320)
    }
}
