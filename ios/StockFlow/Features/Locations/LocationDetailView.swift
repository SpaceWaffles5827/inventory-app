import SwiftUI

struct LocationDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let locationId: String

    @State private var location: Location?
    @State private var error: String?
    @State private var editing = false
    @State private var showLabel = false
    @State private var confirmDelete = false
    @State private var toast: Toast?
    @State private var stockAction: StockAction?
    @State private var pickingItem = false

    var body: some View {
        Group {
            if let location {
                content(location)
            } else if let error {
                ContentUnavailableView {
                    Label("Couldn't Load Location", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Try Again") { Task { await load() } }
                }
            } else {
                ProgressView()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: store.revision) { await load() }
        .stockActionSheet($stockAction) { toast = Toast(message: $0) }
        .toast($toast)
    }

    private func content(_ location: Location) -> some View {
        let items = (location.items ?? []).sorted { $0.quantity > $1.quantity }
        return List {
            Section {
                VStack(spacing: 16) {
                    HStack(spacing: 16) {
                        UtilizationRing(fraction: location.utilization ?? 0)
                            .frame(width: 64, height: 64)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(location.code)
                                .font(.title.bold())
                            if !location.path.isEmpty {
                                Text(location.path)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            if let description = location.description, !description.isEmpty {
                                Text(description)
                                    .font(.subheadline)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    HStack {
                        metric(Format.number(location.totalUnits ?? 0), "units")
                        Divider().frame(height: 30)
                        metric(Format.number(items.filter { $0.quantity > 0 }.count), "items")
                        Divider().frame(height: 30)
                        metric(Format.number(location.capacity), "capacity")
                    }
                }
                .padding(.vertical, 6)
            }

            Section {
                HStack(spacing: 10) {
                    Button {
                        pickingItem = true
                    } label: {
                        Label("Add Stock", systemImage: "plus")
                            .lineLimit(1)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    Button {
                        router.sheet = nil
                        router.openScanner(mode: .count)
                        router.pendingScanCode = location.barcode ?? location.code
                    } label: {
                        Label("Count", systemImage: "checklist")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                .controlSize(.large)
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())

            Section("Contents") {
                if items.isEmpty {
                    Text("Nothing is stored here yet.")
                        .foregroundStyle(.secondary)
                }
                ForEach(items) { entry in
                    NavigationLink(value: ItemRoute(id: entry.id)) {
                        HStack(spacing: 12) {
                            ItemThumbnail(itemId: entry.id, name: entry.name, size: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                                Text(entry.itemNumber).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(Format.number(entry.quantity))
                                .font(.headline.monospacedDigit())
                                .foregroundStyle(entry.quantity > 0 ? .primary : .secondary)
                            Text(entry.unit ?? "")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .swipeActions(edge: .leading) {
                        if let item = store.item(id: entry.id) {
                            Button {
                                stockAction = .adjust(item, .input, locationId: location.id)
                            } label: { Label("Add", systemImage: "plus") }
                            .tint(.green)
                        }
                    }
                    .swipeActions(edge: .trailing) {
                        if let item = store.item(id: entry.id), entry.quantity > 0 {
                            Button {
                                stockAction = .adjust(item, .output, locationId: location.id)
                            } label: { Label("Remove", systemImage: "minus") }
                            .tint(.red)
                            Button {
                                stockAction = .transfer(item, fromLocationId: location.id)
                            } label: { Label("Move", systemImage: "arrow.left.arrow.right") }
                            .tint(.blue)
                        }
                    }
                }
            }

            if let barcode = location.barcode, !barcode.isEmpty {
                Section("Label") {
                    Button { showLabel = true } label: {
                        HStack(spacing: 16) {
                            CodeImage(value: barcode, kind: .qr)
                                .frame(width: 64, height: 64)
                                .padding(6)
                                .background(.white, in: .rect(cornerRadius: 10))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(barcode).font(.body.monospaced())
                                Text("Tap to show a scannable label").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            Section("Recent activity") {
                LocationActivity(locationId: location.id)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(location.code)
        .refreshable { await load() }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Edit Location", systemImage: "pencil") { editing = true }
                    Button("Show Label", systemImage: "qrcode") { showLabel = true }
                    if model.canDelete {
                        Divider()
                        Button("Delete Location", systemImage: "trash", role: .destructive) { confirmDelete = true }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $editing) {
            LocationFormView(location: location) { updated in
                self.location = updated
                Task { await load() }
            }
        }
        .sheet(isPresented: $showLabel) {
            CodeLabelSheet(title: location.code, subtitle: location.path.isEmpty ? nil : location.path, value: location.barcode ?? location.code)
        }
        .sheet(isPresented: $pickingItem) {
            ItemPickerSheet { item in
                pickingItem = false
                Task {
                    try? await Task.sleep(for: .milliseconds(350))
                    stockAction = .adjust(item, .input, locationId: location.id)
                }
            }
        }
        .confirmationDialog("Delete \(location.code)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete Location", role: .destructive) { Task { await delete() } }
        } message: {
            Text("Locations that still hold stock can't be deleted. Stock history keeps a record of this location.")
        }
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.headline.monospacedDigit())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func load() async {
        guard let workspaceId = model.workspace?.id else { return }
        do {
            let fresh = try await model.api.location(id: locationId, workspaceId: workspaceId)
            withAnimation(.snappy) { location = fresh }
            store.apply(fresh)
            error = nil
        } catch is CancellationError {
        } catch {
            if location == nil { self.error = error.localizedDescription }
        }
    }

    private func delete() async {
        guard let workspaceId = model.workspace?.id else { return }
        do {
            try await model.api.deleteLocation(id: locationId, workspaceId: workspaceId)
            store.remove(locationId: locationId)
            Haptics.success()
            if router.sheet == .location(id: locationId) { router.sheet = nil } else { dismiss() }
        } catch {
            Haptics.error()
            toast = Toast(message: error.localizedDescription, style: .error)
        }
    }
}

private struct LocationActivity: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store
    let locationId: String
    @State private var transactions: [StockTransaction] = []
    @State private var loaded = false

    var body: some View {
        Group {
            if loaded && transactions.isEmpty {
                Text("No movements here yet.").foregroundStyle(.secondary)
            }
            ForEach(transactions) { transaction in
                if let item = transaction.item {
                    NavigationLink(value: ItemRoute(id: item.id)) {
                        TransactionRow(transaction: transaction)
                    }
                } else {
                    TransactionRow(transaction: transaction)
                }
            }
        }
        .task(id: store.revision) {
            guard let workspaceId = model.workspace?.id else { return }
            transactions = (try? await model.api.transactions(workspaceId: workspaceId, TransactionQuery(locationId: locationId, limit: 10)))?.transactions ?? []
            loaded = true
        }
    }
}

/// Search the catalog and pick one item.
struct ItemPickerSheet: View {
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let onPick: (Item) -> Void
    @State private var search = ""

    private var results: [Item] {
        let query = search.trimmingCharacters(in: .whitespaces)
        let sorted = store.items.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        guard !query.isEmpty else { return sorted }
        if let exact = CodeMatcher.item(in: store.items, code: query) { return [exact] }
        return sorted.filter {
            $0.name.localizedCaseInsensitiveContains(query) || $0.itemNumber.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            List(results) { item in
                Button {
                    onPick(item)
                } label: {
                    ItemRow(item: item)
                }
                .buttonStyle(.plain)
            }
            .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Name, SKU or barcode")
            .navigationTitle("Choose Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
