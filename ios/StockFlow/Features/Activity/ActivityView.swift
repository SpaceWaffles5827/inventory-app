import SwiftUI

struct TransactionRow: View {
    let transaction: StockTransaction
    var showItem = true

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.type.symbol)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(transaction.type.color)
                .frame(width: 38, height: 38)
                .background(transaction.type.color.opacity(0.13), in: .circle)

            VStack(alignment: .leading, spacing: 3) {
                Text(showItem ? (transaction.item?.name ?? "Deleted item") : transaction.type.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 3) {
                Text(quantityText)
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(transaction.type == .transfer ? Color.primary : transaction.type.color)
                Text(Format.relative(transaction.createdAt))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }

    private var quantityText: String {
        switch transaction.type {
        case .input: "+\(Format.number(transaction.quantity))"
        case .output: "−\(Format.number(transaction.quantity))"
        case .transfer: Format.number(transaction.quantity)
        }
    }

    private var detail: String {
        var parts: [String] = []
        if showItem { parts.append(transaction.type.title) }
        if let location = transaction.locationSummary { parts.append(location) }
        if let lot = transaction.lot { parts.append("Lot \(lot.lotNumber)") }
        if let reason = transaction.reason, !reason.isEmpty, !reason.hasPrefix("Transfer:"),
           !(transaction.lot.map { reason.contains($0.lotNumber) } ?? false) {
            parts.append(reason)
        }
        if let user = transaction.user?.name, !user.isEmpty { parts.append(user) }
        return parts.joined(separator: " · ")
    }
}

/// The full stock movement log, grouped by day, with type filters and infinite scroll.
struct ActivityView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.activityPath) {
            TransactionFeed(query: TransactionQuery(), showsFilter: true)
                .navigationTitle("Activity")
                .appDestinations()
        }
    }
}

/// Paged transaction list used by the Activity tab and by item / location history screens.
struct TransactionFeed: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store

    let query: TransactionQuery
    var showsFilter = false
    var showItem = true

    @State private var transactions: [StockTransaction] = []
    @State private var cursor: String?
    @State private var reachedEnd = false
    @State private var loading = false
    @State private var error: String?
    @State private var filter: TransactionType?

    private var groups: [(day: Date, entries: [StockTransaction])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: transactions) { calendar.startOfDay(for: $0.createdAt) }
        return grouped.keys.sorted(by: >).map { ($0, grouped[$0]!.sorted { $0.createdAt > $1.createdAt }) }
    }

    var body: some View {
        List {
            if let error, transactions.isEmpty {
                ErrorBanner(message: error) { Task { await reload() } }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            ForEach(groups, id: \.day) { group in
                Section(Format.day(group.day)) {
                    ForEach(group.entries) { transaction in
                        row(transaction)
                            .onAppear {
                                if transaction.id == transactions.last?.id { Task { await loadMore() } }
                            }
                    }
                }
            }
            if loading && !transactions.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if transactions.isEmpty && !loading && error == nil {
                ContentUnavailableView(
                    filter == nil ? "No Activity Yet" : "No \(filter!.filterTitle)",
                    systemImage: "clock.arrow.circlepath",
                    description: Text("Stock added, removed and moved will appear here.")
                )
            } else if transactions.isEmpty && loading {
                ProgressView()
            }
        }
        .toolbar {
            if showsFilter {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Type", selection: $filter) {
                            Label("All activity", systemImage: "list.bullet").tag(TransactionType?.none)
                            ForEach(TransactionType.allCases, id: \.self) { type in
                                Label(type.filterTitle, systemImage: type.symbol).tag(TransactionType?.some(type))
                            }
                        }
                    } label: {
                        Image(systemName: filter == nil
                              ? "line.3.horizontal.decrease.circle"
                              : "line.3.horizontal.decrease.circle.fill")
                    }
                    .accessibilityLabel("Filter activity")
                }
            }
        }
        .refreshable { await reload() }
        .task(id: "\(filter?.rawValue ?? "all")-\(store.revision)") { await reload() }
    }

    @ViewBuilder
    private func row(_ transaction: StockTransaction) -> some View {
        if showItem, let item = transaction.item {
            NavigationLink(value: ItemRoute(id: item.id)) {
                TransactionRow(transaction: transaction, showItem: showItem)
            }
        } else {
            TransactionRow(transaction: transaction, showItem: showItem)
        }
    }

    private func reload() async {
        cursor = nil
        reachedEnd = false
        await fetch(replacing: true)
    }

    private func loadMore() async {
        guard !reachedEnd, !loading, cursor != nil else { return }
        await fetch(replacing: false)
    }

    private func fetch(replacing: Bool) async {
        guard let workspaceId = model.workspace?.id else { return }
        loading = true
        defer { loading = false }
        var q = query
        q.type = filter ?? query.type
        q.cursor = replacing ? nil : cursor
        do {
            let page = try await model.api.transactions(workspaceId: workspaceId, q)
            withAnimation(.snappy) {
                transactions = replacing ? page.transactions : transactions + page.transactions
            }
            cursor = page.nextCursor
            reachedEnd = page.nextCursor == nil
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }
}
