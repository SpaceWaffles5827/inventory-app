import SwiftUI

/// Move units of an item (or one of its lots) from one location to another.
struct TransferStockSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let item: Item
    var preferredFromId: String?
    var preferredToId: String?
    let onComplete: (String) -> Void

    @State private var fromId: String?
    @State private var toId: String?
    @State private var lotId: String?
    @State private var quantity = 1
    @State private var reason = ""
    @State private var lots: [Lot] = []
    @State private var working = false
    @State private var error: String?

    private var current: Item { store.item(id: item.id) ?? item }
    private var selectedLot: Lot? { lots.first { $0.id == lotId } }

    private var fromOptions: [LocationOption] {
        if current.lotTracking {
            guard let lot = selectedLot else { return [] }
            return lot.stockedLocations.map { ll in
                let location = store.location(id: ll.locationId)
                return LocationOption(id: ll.locationId, code: location?.code ?? ll.code, path: location?.path ?? "", quantity: ll.quantity)
            }
        }
        return current.stockedOptions(in: store)
    }

    private var toOptions: (assigned: [LocationOption], others: [LocationOption]) {
        let assigned = (current.locations ?? [])
            .filter { $0.locationId != fromId }
            .map { il in
                let location = store.location(id: il.locationId) ?? il.location
                return LocationOption(id: il.locationId, code: location?.code ?? il.code, path: location?.path ?? "", quantity: il.quantity)
            }
        var excluded = Set(assigned.map(\.id))
        if let fromId { excluded.insert(fromId) }
        return (assigned, current.otherOptions(in: store, excluding: excluded))
    }

    private var fromOption: LocationOption? { fromOptions.first { $0.id == fromId } }
    private var toOption: LocationOption? {
        (toOptions.assigned + toOptions.others).first { $0.id == toId }
    }
    private var available: Int { fromOption?.quantity ?? 0 }

    private var canSubmit: Bool {
        fromId != nil && toId != nil && fromId != toId && quantity >= 1 && quantity <= available
            && (!current.lotTracking || lotId != nil)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    StockSheetHeader(item: current)
                }

                if current.lotTracking {
                    Section("Lot") {
                        let withStock = lots.filter { $0.quantity > 0 }
                        if withStock.isEmpty {
                            Text("No lots with stock to move.").foregroundStyle(.secondary)
                        }
                        ForEach(withStock) { lot in
                            Button {
                                lotId = lot.id
                                Haptics.selection()
                            } label: {
                                LotChoiceRow(lot: lot, unit: current.unitLabel, selected: lot.id == lotId)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section {
                    NavigationLink {
                        LocationPickerList(title: "Move from", stocked: fromOptions, others: [], selection: $fromId, unit: current.unitLabel)
                    } label: {
                        LocationChoiceRow(label: "From", symbol: "arrow.up.circle", option: fromOption, unit: current.unitLabel)
                    }
                    .disabled(fromOptions.isEmpty)

                    Button {
                        swap()
                    } label: {
                        HStack {
                            Spacer()
                            Image(systemName: "arrow.up.arrow.down")
                                .font(.body.weight(.semibold))
                            Spacer()
                        }
                    }
                    .disabled(toId == nil || !fromOptions.contains { $0.id == toId })
                    .accessibilityLabel("Swap locations")

                    NavigationLink {
                        LocationPickerList(
                            title: "Move to",
                            stocked: toOptions.assigned,
                            others: toOptions.others,
                            selection: $toId,
                            unit: current.unitLabel
                        )
                    } label: {
                        LocationChoiceRow(label: "To", symbol: "arrow.down.circle", option: toOption, unit: current.unitLabel)
                    }
                } footer: {
                    if fromOptions.isEmpty {
                        Text("This item has no stock to move.")
                    }
                }

                Section {
                    QuantityStepper(value: $quantity, range: 1...max(1, available), unit: current.unitLabel, tint: .blue)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                    if available > 1 {
                        Button("Move all \(Format.number(available))") {
                            quantity = available
                            Haptics.selection()
                        }
                        .frame(maxWidth: .infinity)
                    }
                }

                Section("Note") {
                    TextField("Reason (optional)", text: $reason, axis: .vertical)
                        .lineLimit(1...3)
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.octagon.fill").foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Move Stock")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                ConfirmBar(
                    title: toOption.map { "Move \(Format.number(quantity)) to \($0.code)" } ?? "Move \(Format.number(quantity)) \(current.unitLabel)",
                    tint: .blue,
                    enabled: canSubmit,
                    working: working,
                    action: submit
                )
            }
            .onChange(of: fromId) { _, _ in
                if toId == fromId { toId = nil }
                quantity = min(max(1, quantity), max(1, available))
            }
            .onChange(of: lotId) { _, _ in
                fromId = fromOptions.first?.id
            }
            .task {
                if store.locations.isEmpty { try? await store.refreshLocations() }
                if current.lotTracking {
                    lots = ((try? await model.api.lots(itemId: item.id)) ?? [])
                        .filter { $0.quantity > 0 }
                        .sorted { ($0.expirationDate ?? .distantFuture) < ($1.expirationDate ?? .distantFuture) }
                    lotId = lots.first?.id
                }
                if fromId == nil {
                    fromId = fromOptions.first { $0.id == preferredFromId }?.id ?? fromOptions.first?.id
                }
                if toId == nil, let preferredToId, preferredToId != fromId {
                    toId = preferredToId
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    private func swap() {
        guard let toId, fromOptions.contains(where: { $0.id == toId }) else { return }
        let oldFrom = fromId
        fromId = toId
        self.toId = oldFrom
        Haptics.selection()
    }

    private func submit() {
        guard let fromId, let toId, canSubmit else { return }
        working = true
        error = nil
        let note = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        let toCode = toOption?.code ?? "location"
        Task {
            do {
                let updated = try await model.api.transferStock(itemId: item.id, TransferStockBody(
                    quantity: quantity,
                    fromLocationId: fromId,
                    toLocationId: toId,
                    lotId: current.lotTracking ? lotId : nil,
                    reason: note.isEmpty ? nil : note
                ))
                store.apply(updated)
                try? await store.refreshLocations()
                Haptics.success()
                onComplete("Moved \(Format.number(quantity)) \(current.unitLabel) to \(toCode)")
                dismiss()
            } catch {
                self.error = error.localizedDescription
                Haptics.error()
            }
            working = false
        }
    }
}
