import SwiftUI
import Charts

struct OverviewView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store

    @State private var summary: DashboardSummary?
    @State private var analytics: Analytics?
    @State private var expiring: [Lot] = []
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.overviewPath) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if let error, summary == nil {
                        ErrorBanner(message: error) { Task { await load() } }
                    }

                    quickActions

                    metrics

                    if let analytics, !analytics.movementData.isEmpty {
                        MovementCard(analytics: analytics)
                    }

                    attentionSection

                    if !expiring.isEmpty {
                        expiringSection
                    }

                    recentActivity
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(model.workspace?.name ?? "Overview")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceMenu()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        router.sheet = .settings
                    } label: {
                        AvatarView(initials: model.user?.initials ?? "?", size: 32)
                    }
                    .accessibilityLabel("Account and settings")
                }
            }
            .refreshable { await load(refreshCatalog: true) }
            .task(id: store.revision) { await load() }
            .appDestinations()
        }
    }

    // MARK: Sections

    private var quickActions: some View {
        HStack(spacing: 10) {
            QuickActionButton(title: "Scan", symbol: "barcode.viewfinder", tint: .accentColor) {
                router.openScanner(mode: .find)
            }
            QuickActionButton(title: "Receive", symbol: "tray.and.arrow.down.fill", tint: .green) {
                router.openScanner(mode: .receive)
            }
            QuickActionButton(title: "Pick", symbol: "tray.and.arrow.up.fill", tint: .orange) {
                router.openScanner(mode: .pick)
            }
            QuickActionButton(title: "Move", symbol: "arrow.left.arrow.right", tint: .blue) {
                router.openScanner(mode: .move)
            }
        }
        .padding(.top, 4)
    }

    private var metrics: some View {
        let s = summary
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            StatCard(
                title: "Inventory value",
                value: s.map { Format.compactCurrency($0.inventoryValue) } ?? "—",
                symbol: "dollarsign",
                tint: .green
            )
            StatCard(
                title: "Units on hand",
                value: s.map { Format.compact($0.totalUnits) } ?? "—",
                symbol: "cube.box.fill",
                tint: .accentColor
            )
            Button {
                router.requestedInventoryFilter = .lowStock
                router.tab = .inventory
            } label: {
                StatCard(
                    title: "Low stock",
                    value: s.map { Format.number($0.lowStockCount) } ?? "—",
                    symbol: "exclamationmark.triangle.fill",
                    tint: .orange
                )
            }
            .buttonStyle(.plain)
            Button {
                router.requestedInventoryFilter = .outOfStock
                router.tab = .inventory
            } label: {
                StatCard(
                    title: "Out of stock",
                    value: s.map { Format.number($0.outOfStockCount) } ?? "—",
                    symbol: "xmark.octagon.fill",
                    tint: .red
                )
            }
            .buttonStyle(.plain)
        }
        .redacted(reason: s == nil && loading ? .placeholder : [])
        .animation(.snappy, value: summary)
    }

    @ViewBuilder
    private var attentionSection: some View {
        if let items = summary?.lowStockItems {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "Needs attention") {
                    if !items.isEmpty {
                        Button("See all") {
                            router.requestedInventoryFilter = .needsAttention
                            router.tab = .inventory
                        }
                    }
                }
                if items.isEmpty {
                    HStack(spacing: 12) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.title2)
                            .foregroundStyle(.green)
                        VStack(alignment: .leading) {
                            Text("Everything is stocked").font(.headline)
                            Text("No items are at or below their reorder point.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(items.prefix(5).enumerated()), id: \.element.id) { index, entry in
                            if index > 0 { Divider().padding(.leading, 70) }
                            NavigationLink(value: ItemRoute(id: entry.id)) {
                                LowStockRow(entry: entry)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .card(padding: 0)
                }
            }
        }
    }

    private var expiringSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Expiring soon")
            VStack(spacing: 0) {
                ForEach(Array(expiring.prefix(5).enumerated()), id: \.element.id) { index, lot in
                    if index > 0 { Divider().padding(.leading, 60) }
                    NavigationLink(value: LotRoute(id: lot.id)) {
                        ExpiringLotRow(lot: lot)
                    }
                    .buttonStyle(.plain)
                }
            }
            .card(padding: 0)
        }
    }

    @ViewBuilder
    private var recentActivity: some View {
        if let transactions = summary?.recentTransactions {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "Recent activity") {
                    Button("See all") { router.tab = .activity }
                }
                if transactions.isEmpty {
                    Text("Stock movements will show up here.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .card()
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(transactions.prefix(6).enumerated()), id: \.element.id) { index, transaction in
                            if index > 0 { Divider().padding(.leading, 64) }
                            if let item = transaction.item {
                                NavigationLink(value: ItemRoute(id: item.id)) {
                                    TransactionRow(transaction: transaction)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 10)
                                }
                                .buttonStyle(.plain)
                            } else {
                                TransactionRow(transaction: transaction)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 10)
                            }
                        }
                    }
                    .card(padding: 0)
                }
            }
        }
    }

    // MARK: Loading

    private func load(refreshCatalog: Bool = false) async {
        guard let workspaceId = model.workspace?.id else { return }
        loading = true
        defer { loading = false }
        let api = model.api
        async let summaryTask = api.dashboard(workspaceId: workspaceId)
        async let analyticsTask = try? api.analytics(workspaceId: workspaceId, timeRange: "30days")
        async let expiringTask = try? api.expiringLots(workspaceId: workspaceId, days: 30)
        if refreshCatalog { await store.refreshAll() }
        do {
            let fresh = try await summaryTask
            withAnimation(.snappy) { summary = fresh }
            error = nil
        } catch is CancellationError {
            return
        } catch {
            self.error = error.localizedDescription
        }
        analytics = await analyticsTask ?? analytics
        expiring = await expiringTask ?? expiring
    }
}

// MARK: - Pieces

private struct QuickActionButton: View {
    let title: String
    let symbol: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            VStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(height: 24)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(PressableStyle())
    }
}

/// Subtle scale-down on press, like system tiles.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

private struct LowStockRow: View {
    let entry: LowStockEntry

    private var status: ItemStatus { .derive(onHand: entry.onHand, reorderPoint: entry.reorderPoint) }

    var body: some View {
        HStack(spacing: 12) {
            ItemThumbnail(itemId: entry.id, name: entry.name, size: 44)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(entry.name)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Spacer()
                    Text("\(Format.number(entry.onHand)) / \(Format.number(entry.reorderPoint))")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(status.color)
                }
                StockGauge(onHand: entry.onHand, reorderPoint: entry.reorderPoint)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(.rect)
    }
}

private struct ExpiringLotRow: View {
    let lot: Lot

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: lot.isExpired ? "calendar.badge.exclamationmark" : "calendar.badge.clock")
                .font(.title3)
                .foregroundStyle(lot.isExpired ? .red : .orange)
                .frame(width: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(lot.item?.name ?? "Lot")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text("Lot \(lot.lotNumber) · \(Format.number(lot.quantity)) \(lot.item?.unit ?? "units")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let days = lot.daysUntilExpiry {
                Text(Format.expiry(days: days))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(days < 0 ? .red : .orange)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(.rect)
    }
}

private struct MovementCard: View {
    let analytics: Analytics

    private struct Bar: Identifiable {
        let id: String
        let index: Int
        let direction: String
        let units: Int
    }

    private var points: [Analytics.MovementPoint] { analytics.movementData }

    private var bars: [Bar] {
        points.enumerated().flatMap { index, point in
            [
                Bar(id: "\(index)-in", index: index, direction: "In", units: point.stockIn),
                Bar(id: "\(index)-out", index: index, direction: "Out", units: -point.stockOut),
            ]
        }
    }

    /// First, middle and last day get a label; the rest stay clean.
    private var labeledIndexes: [Int] {
        guard points.count > 2 else { return Array(points.indices) }
        return [0, points.count / 2, points.count - 1]
    }

    private var yLimit: Int {
        let peak = points.map { max($0.stockIn, $0.stockOut) }.max() ?? 0
        return max(5, Int((Double(peak) * 1.15).rounded(.up)))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Stock movement")
                        .font(.headline)
                    Text("Last 30 days")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                HStack(spacing: 14) {
                    metric("In", value: analytics.keyMetrics.unitsIn, color: .green)
                    metric("Out", value: analytics.keyMetrics.unitsOut, color: .red)
                }
            }

            Chart(bars) { bar in
                BarMark(
                    x: .value("Day", bar.index),
                    y: .value("Units", bar.units),
                    width: .fixed(max(3, 220 / CGFloat(max(points.count, 1))))
                )
                .foregroundStyle(by: .value("Direction", bar.direction))
                .cornerRadius(3)
            }
            .chartForegroundStyleScale(["In": Color.green.gradient, "Out": Color.red.gradient])
            .chartLegend(.hidden)
            .chartXScale(domain: -0.5...(Double(max(points.count, 1)) - 0.5))
            .chartYScale(domain: -yLimit...yLimit)
            .chartXAxis {
                AxisMarks(values: labeledIndexes) { value in
                    let index = value.as(Int.self) ?? 0
                    AxisValueLabel(anchor: index == 0 ? .topLeading : index == points.count - 1 ? .topTrailing : .top) {
                        if points.indices.contains(index) {
                            Text(points[index].label)
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                    AxisGridLine()
                    AxisValueLabel {
                        if let units = value.as(Int.self) { Text(Format.compact(abs(units))) }
                    }
                }
            }
            .frame(height: 150)
        }
        .card()
    }

    private func metric(_ title: String, value: Int, color: Color) -> some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(Format.compact(value))
                .font(.headline.monospacedDigit())
                .foregroundStyle(color)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Workspace & avatar

struct AvatarView: View {
    let initials: String
    var size: CGFloat = 36

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color.accentColor.gradient, in: .circle)
    }
}

struct WorkspaceMenu: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Menu {
            Section("Workspaces") {
                ForEach(model.workspaces) { workspace in
                    Button {
                        model.select(workspace)
                        Haptics.selection()
                    } label: {
                        if workspace.id == model.workspace?.id {
                            Label(workspace.name, systemImage: "checkmark")
                        } else {
                            Text(workspace.name)
                        }
                    }
                }
            }
            Button("Refresh", systemImage: "arrow.clockwise") {
                Task { try? await model.reloadWorkspaces() }
            }
        } label: {
            Image(systemName: "building.2")
        }
        .accessibilityLabel("Switch workspace")
    }
}
