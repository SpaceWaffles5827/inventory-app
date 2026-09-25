import SwiftUI

/// Add or remove stock of one item at one location (and lot, for lot-tracked items).
struct AdjustStockSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let item: Item
    @State var direction: StockDirection
    var preferredLocationId: String?
    let onComplete: (String) -> Void

    @State private var quantity = 1
    @State private var locationId: String?
    @State private var lotId: String?
    @State private var reason = ""
    @State private var lots: [Lot] = []
    @State private var loadingLots = false
    @State private var working = false
    @State private var error: String?
    @State private var receiveNewLot = false

    init(item: Item, direction: StockDirection, preferredLocationId: String? = nil, onComplete: @escaping (String) -> Void) {
        self.item = item
        self._direction = State(initialValue: direction)
        self.preferredLocationId = preferredLocationId
        self.onComplete = onComplete
    }

    private var current: Item { store.item(id: item.id) ?? item }
    private var selectedLot: Lot? { lots.first { $0.id == lotId } }

    /// Locations that hold the item (or the chosen lot). When adding, zero-stock
    /// locations the item is assigned to are included so they can be restocked.
    private var stockedOptions: [LocationOption] {
        if current.lotTracking {
            guard let lot = selectedLot else { return [] }
            return lot.locations
                .filter { direction == .input || $0.quantity > 0 }
                .sorted { $0.quantity > $1.quantity }
                .map { ll in
                    let location = store.location(id: ll.locationId)
                    return LocationOption(id: ll.locationId, code: location?.code ?? ll.code, path: location?.path ?? "", quantity: ll.quantity)
                }
        }
        return (current.locations ?? [])
            .filter { direction == .input || $0.quantity > 0 }
            .sorted { $0.quantity > $1.quantity }
            .map { il in
                let location = store.location(id: il.locationId) ?? il.location
                return LocationOption(id: il.locationId, code: location?.code ?? il.code, path: location?.path ?? "", quantity: il.quantity)
            }
    }

    private var otherOptions: [LocationOption] {
        guard direction == .input else { return [] }
        return current.otherOptions(in: store, excluding: Set(stockedOptions.map(\.id)))
    }

    private var selectedOption: LocationOption? {
        (stockedOptions + otherOptions).first { $0.id == locationId }
            ?? store.location(id: locationId ?? "").map { LocationOption(id: $0.id, code: $0.code, path: $0.path, quantity: nil) }
    }

    private var available: Int { selectedOption?.quantity ?? 0 }

    private var validationMessage: String? {
        if current.lotTracking && lotId == nil { return nil }
        if locationId == nil { return nil }
        if direction == .output && quantity > available {
            return "Only \(Format.number(available)) \(current.unitLabel) at \(selectedOption?.code ?? "this location")."
        }
        return nil
    }

    private var canSubmit: Bool {
        locationId != nil && quantity > 0 && (!current.lotTracking || lotId != nil) && validationMessage == nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    StockSheetHeader(item: current)
                    Picker("Direction", selection: $direction) {
                        ForEach(StockDirection.allCases) { direction in
                            Label(direction.title, systemImage: direction.symbol).tag(direction)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowSeparator(.hidden)
                }

                Section {
                    QuantityStepper(
                        value: $quantity,
                        range: 1...max(1, direction == .output && locationId != nil ? max(available, 1) : 1_000_000),
                        unit: current.unitLabel,
                        tint: direction.color
                    )
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }

                if current.lotTracking {
                    lotSection
                }

                Section {
                    NavigationLink {
                        LocationPickerList(
                            title: direction == .input ? "Add to" : "Remove from",
                            stocked: stockedOptions,
                            others: otherOptions,
                            selection: $locationId,
                            unit: current.unitLabel
                        )
                    } label: {
                        LocationChoiceRow(
                            label: direction == .input ? "Add to" : "Remove from",
                            symbol: "mappin.and.ellipse",
                            option: selectedOption,
                            unit: current.unitLabel
                        )
                    }
                    .disabled(current.lotTracking && lotId == nil)
                } footer: {
                    if direction == .output && stockedOptions.isEmpty && !(current.lotTracking && lotId == nil) {
                        Text("There's no stock of this item to remove.")
                    }
                }

                Section("Reason") {
                    ReasonPicker(
                        reason: $reason,
                        suggestions: direction == .input ? ReasonPicker.inbound : ReasonPicker.outbound
                    )
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.octagon.fill")
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(direction.verb)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                ConfirmBar(
                    title: "\(direction.title) \(Format.number(quantity)) \(current.unitLabel)",
                    tint: direction.color,
                    enabled: canSubmit,
                    working: working,
                    footnote: validationMessage,
                    action: submit
                )
            }
            .animation(.snappy, value: direction)
            .onChange(of: direction) { _, _ in chooseDefaultLocation(force: true) }
            .onChange(of: lotId) { _, _ in chooseDefaultLocation(force: true) }
            .task {
                if store.locations.isEmpty { try? await store.refreshLocations() }
                if current.lotTracking { await loadLots() }
                chooseDefaultLocation(force: false)
            }
            .sheet(isPresented: $receiveNewLot) {
                ReceiveLotSheet(item: current) { message in
                    onComplete(message)
                    dismiss()
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder private var lotSection: some View {
        Section {
            if loadingLots && lots.isEmpty {
                HStack { ProgressView(); Text("Loading lots…").foregroundStyle(.secondary) }
            } else {
                let choices = lots.filter { direction == .input ? $0.status != .recalled : $0.quantity > 0 }
                if choices.isEmpty {
                    Text(direction == .input ? "No lots yet." : "No lots with stock.")
                        .foregroundStyle(.secondary)
                }
                ForEach(choices) { lot in
                    Button {
                        lotId = lot.id
                        Haptics.selection()
                    } label: {
                        LotChoiceRow(lot: lot, unit: current.unitLabel, selected: lot.id == lotId)
                    }
                    .buttonStyle(.plain)
                }
            }
            if direction == .input {
                Button {
                    receiveNewLot = true
                } label: {
                    Label("Receive a new lot…", systemImage: "plus.circle.fill")
                }
            }
        } header: {
            Text("Lot")
        } footer: {
            if direction == .output, let first = lots.first(where: { $0.quantity > 0 && $0.expirationDate != nil }) {
                Text("First to expire: \(first.lotNumber)")
            }
        }
    }

    private func chooseDefaultLocation(force: Bool) {
        if current.lotTracking, lotId == nil || selectedLot == nil {
            // FEFO: default to the earliest-expiring lot with stock when removing.
            let candidates = lots.filter { direction == .output ? $0.quantity > 0 : $0.status == .active }
            lotId = candidates.first?.id
        }
        let valid = Set((stockedOptions + otherOptions).map(\.id))
        if let locationId, valid.contains(locationId), !(force && direction == .output && available == 0) { return }
        if let preferred = preferredLocationId, valid.contains(preferred) {
            locationId = preferred
            return
        }
        locationId = stockedOptions.first?.id ?? otherOptions.first?.id
    }

    private func loadLots() async {
        loadingLots = true
        defer { loadingLots = false }
        if let fetched = try? await model.api.lots(itemId: item.id) {
            lots = fetched
                .filter { !($0.isSystem && $0.quantity == 0) }
                .sorted { ($0.expirationDate ?? .distantFuture, $0.lotNumber) < ($1.expirationDate ?? .distantFuture, $1.lotNumber) }
        }
    }

    private func submit() {
        guard let locationId, canSubmit else { return }
        working = true
        error = nil
        let fallbackReason = direction == .input ? "Stock added" : "Stock removed"
        let reasonText = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        let code = selectedOption?.code ?? "location"
        Task {
            do {
                if current.lotTracking, let lotId {
                    _ = try await model.api.adjustLot(id: lotId, AdjustLotBody(
                        type: direction, quantity: quantity, locationId: locationId,
                        reason: reasonText.isEmpty ? nil : reasonText
                    ))
                    await store.reload(itemId: item.id)
                } else {
                    let updated = try await model.api.adjustStock(itemId: item.id, AdjustStockBody(
                        type: direction, quantity: quantity,
                        reason: reasonText.isEmpty ? fallbackReason : reasonText,
                        locationId: locationId
                    ))
                    store.apply(updated)
                    try? await store.refreshLocations()
                }
                Haptics.success()
                let verb = direction == .input ? "Added" : "Removed"
                let preposition = direction == .input ? "to" : "from"
                onComplete("\(verb) \(Format.number(quantity)) \(current.unitLabel) \(preposition) \(code)")
                dismiss()
            } catch {
                self.error = error.localizedDescription
                Haptics.error()
            }
            working = false
        }
    }
}

struct LotChoiceRow: View {
    let lot: Lot
    let unit: String
    let selected: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                .font(.title3)
                .foregroundStyle(selected ? Color.accentColor : Color.secondary)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(lot.lotNumber)
                        .font(.body.weight(.semibold).monospaced())
                    if lot.status != .active {
                        Pill(text: lot.status.title, color: lot.status.color)
                    }
                }
                if let days = lot.daysUntilExpiry {
                    Text(Format.expiry(days: days))
                        .font(.caption)
                        .foregroundStyle(days < 0 ? .red : days <= 30 ? .orange : .secondary)
                } else {
                    Text("No expiry")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text("\(Format.number(lot.quantity)) \(unit)")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .contentShape(.rect)
    }
}
