import SwiftUI

// Bottom panels of the Scan tab. They float over the camera as glass cards.

// MARK: - Find result

struct ScanResultCard: View {
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store

    let match: ScanMatch
    @Binding var action: StockAction?
    let onCount: (Location) -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            switch match {
            case .item(let scanned):
                itemCard(store.item(id: scanned.id) ?? scanned)
            case .location(let scanned):
                locationCard(store.location(id: scanned.id) ?? scanned)
            case .unknown(let code):
                unknownCard(code)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassRounded(28, tint: .black.opacity(0.3))
        .overlay(alignment: .topTrailing) {
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.8))
                    .frame(width: 28, height: 28)
                    .background(.white.opacity(0.12), in: .circle)
            }
            .padding(12)
            .accessibilityLabel("Dismiss")
        }
    }

    private func itemCard(_ item: Item) -> some View {
        let status = ItemStatus.derive(onHand: item.onHand, reorderPoint: item.reorderPoint)
        return VStack(alignment: .leading, spacing: 14) {
            Button {
                router.sheet = .item(id: item.id)
            } label: {
                HStack(spacing: 14) {
                    ItemThumbnail(itemId: item.id, name: item.name, size: 58)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.name)
                            .font(.headline)
                            .foregroundStyle(.white)
                            .lineLimit(2)
                        Text(item.itemNumber)
                            .font(.caption.monospaced())
                            .foregroundStyle(.white.opacity(0.65))
                        StatusBadge(status: status, compact: true)
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(Format.number(item.onHand))
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .contentTransition(.numericText(value: Double(item.onHand)))
                        Text(item.unitLabel)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.65))
                    }
                    .padding(.trailing, 30)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)

            if !item.stockedLocations.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(item.stockedLocations.prefix(6)) { location in
                            HStack(spacing: 4) {
                                Image(systemName: "mappin")
                                Text(location.code)
                                Text(Format.number(location.quantity)).foregroundStyle(.white.opacity(0.65))
                            }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(.white.opacity(0.12), in: .capsule)
                        }
                    }
                }
            }

            HStack(spacing: 8) {
                CardAction(title: "Add", symbol: "plus", tint: .green) { action = .adjust(item, .input) }
                CardAction(title: "Remove", symbol: "minus", tint: .red) { action = .adjust(item, .output) }
                    .disabled(item.onHand <= 0)
                CardAction(title: "Move", symbol: "arrow.left.arrow.right", tint: .blue) { action = .transfer(item) }
                    .disabled(item.onHand <= 0)
                CardAction(title: "Details", symbol: "info", tint: .white) { router.sheet = .item(id: item.id) }
            }
        }
    }

    private func locationCard(_ location: Location) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 58, height: 58)
                    .background(Color.accentColor.gradient, in: .rect(cornerRadius: 16, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(location.code)
                        .font(.headline)
                        .foregroundStyle(.white)
                    if !location.path.isEmpty {
                        Text(location.path)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.65))
                    }
                    Text("\(Format.number(location.totalUnits ?? 0)) units · \(location.itemCount) items")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.85))
                }
                Spacer(minLength: 30)
            }
            HStack(spacing: 8) {
                CardAction(title: "Contents", symbol: "list.bullet", tint: .white) { router.sheet = .location(id: location.id) }
                CardAction(title: "Count here", symbol: "checklist", tint: .purple) { onCount(location) }
            }
        }
    }

    private func unknownCard(_ code: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                Image(systemName: "questionmark.square.dashed")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.orange)
                    .frame(width: 58, height: 58)
                    .background(Color.orange.opacity(0.16), in: .rect(cornerRadius: 16, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text("No match")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(code)
                        .font(.callout.monospaced())
                        .foregroundStyle(.white.opacity(0.75))
                        .textSelection(.enabled)
                    Text("Not an item or location in this workspace.")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }
                Spacer(minLength: 30)
            }
            HStack(spacing: 8) {
                CardAction(title: "Create item with this barcode", symbol: "plus.square", tint: .accentColor) {
                    router.sheet = .newItem(barcode: code)
                }
            }
        }
    }
}

private struct CardAction: View {
    let title: String
    let symbol: String
    let tint: Color
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            VStack(spacing: 5) {
                Image(systemName: symbol)
                    .font(.system(size: 16, weight: .bold))
                Text(title)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(tint == .white ? Color.white : tint)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background((tint == .white ? Color.white : tint).opacity(0.16), in: .rect(cornerRadius: 14, style: .continuous))
            .opacity(isEnabled ? 1 : 0.4)
        }
        .buttonStyle(PressableStyle())
    }
}

// MARK: - Receive / Pick batch

struct BatchPanel: View {
    @Environment(InventoryStore.self) private var store
    let session: ScanSession
    let committing: Bool
    let onChooseLocation: () -> Void
    let onCommit: () -> Void

    private var direction: StockDirection { session.mode.direction ?? .input }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                LocationChip(
                    label: direction == .input ? "Into" : "From",
                    code: session.location?.code ?? "Best location",
                    action: onChooseLocation
                )
                Spacer()
                if !session.cart.isEmpty {
                    Button("Clear") {
                        withAnimation { session.clearCart() }
                        Haptics.tap()
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.8))
                }
            }

            if session.cart.isEmpty {
                Text(session.mode.prompt)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 6)
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(session.cart) { line in
                            CartLineRow(line: line, tint: session.mode.tint) { quantity in
                                session.setQuantity(quantity, for: line.id)
                            }
                        }
                    }
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(height: min(CGFloat(session.cart.count) * 66 - 8, 220))

                Button(action: onCommit) {
                    ZStack {
                        Text("\(direction == .input ? "Receive" : "Pick") \(Format.number(session.totalUnits)) units")
                            .opacity(committing ? 0 : 1)
                        if committing { ProgressView().tint(.white) }
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                }
                .prominentGlassButton()
                .tint(session.mode.tint)
                .controlSize(.large)
                .disabled(committing)
            }
        }
        .padding(16)
        .glassRounded(28, tint: .black.opacity(0.3))
    }
}

private struct CartLineRow: View {
    let line: CartLine
    let tint: Color
    var variance: Int?
    let setQuantity: (Int) -> Void

    var body: some View {
        HStack(spacing: 10) {
            ItemThumbnail(itemId: line.item.id, name: line.item.name, size: 38)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(line.item.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let variance { VarianceBadge(variance: variance) }
                }
                if let error = line.error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.orange)
                        .lineLimit(2)
                } else {
                    Text("\(Format.number(line.item.onHand)) \(line.item.unitLabel) on hand")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
            Spacer(minLength: 4)
            HStack(spacing: 0) {
                Button {
                    setQuantity(line.quantity - 1)
                    Haptics.selection()
                } label: {
                    Image(systemName: line.quantity == 1 ? "trash" : "minus")
                        .frame(width: 32, height: 32)
                }
                Text("\(line.quantity)")
                    .font(.headline.monospacedDigit())
                    .frame(minWidth: 30)
                    .contentTransition(.numericText(value: Double(line.quantity)))
                Button {
                    setQuantity(line.quantity + 1)
                    Haptics.selection()
                } label: {
                    Image(systemName: "plus")
                        .frame(width: 32, height: 32)
                }
            }
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.white)
            .background(.white.opacity(0.12), in: .capsule)
            .buttonStyle(.plain)
        }
        .padding(8)
        .background(.white.opacity(line.error == nil ? 0.06 : 0.1), in: .rect(cornerRadius: 16, style: .continuous))
        .overlay {
            if line.error != nil {
                RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.orange.opacity(0.6))
            }
        }
        .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity), removal: .opacity))
    }
}

struct LocationChip: View {
    let label: String
    let code: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "mappin.circle.fill")
                Text(label).foregroundStyle(.white.opacity(0.65))
                Text(code).fontWeight(.semibold)
                Image(systemName: "chevron.down").font(.caption2.weight(.bold))
            }
            .font(.subheadline)
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.white.opacity(0.14), in: .capsule)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Move

struct MovePanel: View {
    let session: ScanSession
    let onChooseDestination: () -> Void
    let onChooseSource: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            step(
                number: 1,
                title: session.moveItem?.name ?? "Scan the item",
                detail: session.moveItem.map { "\(Format.number($0.onHand)) \($0.unitLabel) on hand" },
                done: session.moveItem != nil
            )
            step(
                number: 2,
                title: session.location.map { "From \($0.code)" } ?? "From its fullest location",
                detail: session.location == nil ? "Scan a location first to choose the source" : nil,
                done: true,
                action: ("Change", onChooseSource)
            )
            step(
                number: 3,
                title: "Scan the destination",
                detail: nil,
                done: false,
                action: session.moveItem == nil ? nil : ("Choose", onChooseDestination)
            )
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassRounded(28, tint: .black.opacity(0.3))
    }

    private func step(number: Int, title: String, detail: String?, done: Bool, action: (String, () -> Void)? = nil) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(done ? Color.blue : Color.white.opacity(0.15))
                if done && number != 2 {
                    Image(systemName: "checkmark").font(.caption.weight(.bold))
                } else {
                    Text("\(number)").font(.caption.weight(.bold))
                }
            }
            .foregroundStyle(.white)
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let detail {
                    Text(detail).font(.caption).foregroundStyle(.white.opacity(0.6))
                }
            }
            Spacer()
            if let action {
                Button(action.0, action: action.1)
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .tint(.white)
            }
        }
    }
}

// MARK: - Count

struct CountPanel: View {
    let session: ScanSession
    let onChooseLocation: () -> Void
    let onReview: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                LocationChip(label: "At", code: session.location?.code ?? "Choose location", action: onChooseLocation)
                Spacer()
                if session.location != nil {
                    Text("\(session.cart.count) of \(session.expectedItems.count) items")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.7))
                }
            }

            if session.location == nil {
                Text(ScanMode.count.prompt)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
            } else if session.cart.isEmpty {
                Text("Scan each unit on the shelf. Counts are compared with what StockFlow expects here.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(session.cart) { line in
                            CartLineRow(line: line, tint: .purple, variance: session.variance(for: line)) { quantity in
                                session.setQuantity(quantity, for: line.id)
                            }
                        }
                    }
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(height: min(CGFloat(session.cart.count) * 66 - 8, 200))
            }

            if session.location != nil {
                Button(action: onReview) {
                    Text("Review count")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
                .prominentGlassButton()
                .tint(.purple)
                .controlSize(.large)
            }
        }
        .padding(16)
        .glassRounded(28, tint: .black.opacity(0.3))
    }
}

private struct VarianceBadge: View {
    let variance: Int

    var body: some View {
        if variance != 0 {
            Text(variance > 0 ? "+\(variance)" : "\(variance)")
                .font(.caption2.weight(.bold).monospacedDigit())
                .foregroundStyle(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(variance > 0 ? Color.green : Color.red, in: .capsule)
        }
    }
}

/// Compare counted vs expected at a location and post the differences as adjustments.
struct CountReviewSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let session: ScanSession
    let onComplete: (String) -> Void

    @State private var zeroUnscanned = false
    @State private var working = false
    @State private var errors: [String: String] = [:]

    private struct Row: Identifiable {
        let id: String
        let name: String
        let unit: String
        let expected: Int
        let counted: Int
        let lotTracked: Bool
        var variance: Int { counted - expected }
    }

    private var rows: [Row] {
        var result: [Row] = session.cart.map { line in
            Row(
                id: line.item.id,
                name: line.item.name,
                unit: line.item.unitLabel,
                expected: session.expected[line.item.id] ?? 0,
                counted: line.quantity,
                lotTracked: (store.item(id: line.item.id) ?? line.item).lotTracking
            )
        }
        let scanned = Set(session.cart.map(\.id))
        for item in session.expectedItems where !scanned.contains(item.id) {
            result.append(Row(
                id: item.id,
                name: item.name,
                unit: item.unit ?? "units",
                expected: item.quantity,
                counted: zeroUnscanned ? 0 : item.quantity,
                lotTracked: store.item(id: item.id)?.lotTracking ?? false
            ))
        }
        return result
    }

    private var adjustments: [Row] { rows.filter { $0.variance != 0 && !$0.lotTracked } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Toggle("Unscanned items are missing", isOn: $zeroUnscanned.animation())
                } footer: {
                    Text("When on, items StockFlow expects at \(session.location?.code ?? "this location") that you didn't scan are counted as 0.")
                }

                Section("Items") {
                    ForEach(rows) { row in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.name).font(.subheadline.weight(.semibold))
                                Text("Expected \(row.expected) · Counted \(row.counted)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if row.lotTracked && row.variance != 0 {
                                    Text("Lot tracked: adjust per lot from the item screen")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                }
                                if let error = errors[row.id] {
                                    Text(error).font(.caption).foregroundStyle(.red)
                                }
                            }
                            Spacer()
                            Text(row.variance == 0 ? "OK" : (row.variance > 0 ? "+\(row.variance)" : "\(row.variance)"))
                                .font(.headline.monospacedDigit())
                                .foregroundStyle(row.variance == 0 ? Color.green : (row.variance > 0 ? Color.blue : Color.red))
                        }
                    }
                }
            }
            .navigationTitle("Count at \(session.location?.code ?? "")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Keep Counting") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                ConfirmBar(
                    title: adjustments.isEmpty ? "No differences" : "Apply \(adjustments.count) \(adjustments.count == 1 ? "adjustment" : "adjustments")",
                    tint: .purple,
                    enabled: !adjustments.isEmpty,
                    working: working,
                    action: apply
                )
            }
        }
        .presentationDragIndicator(.visible)
    }

    private func apply() {
        guard let locationId = session.location?.id else { return }
        working = true
        errors = [:]
        let pending = adjustments
        Task {
            var applied = 0
            for row in pending {
                do {
                    let updated = try await model.api.adjustStock(itemId: row.id, AdjustStockBody(
                        type: row.variance > 0 ? .input : .output,
                        quantity: abs(row.variance),
                        reason: "Cycle count",
                        locationId: locationId
                    ))
                    store.apply(updated)
                    applied += 1
                } catch {
                    errors[row.id] = error.localizedDescription
                }
            }
            try? await store.refreshLocations()
            working = false
            if errors.isEmpty {
                Haptics.success()
                onComplete("Count saved · \(applied) \(applied == 1 ? "adjustment" : "adjustments")")
                session.clearCart()
                session.location = nil
                session.expected = [:]
                session.expectedItems = []
                dismiss()
            } else {
                Haptics.error()
            }
        }
    }
}
