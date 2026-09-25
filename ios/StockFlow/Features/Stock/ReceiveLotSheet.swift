import SwiftUI

/// Receive a new lot (batch) of a lot-tracked item into a location.
struct ReceiveLotSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let item: Item
    let onComplete: (String) -> Void

    @State private var lotNumber = ""
    @State private var quantity = 1
    @State private var locationId: String?
    @State private var hasExpiry = false
    @State private var expirationDate = Calendar.current.date(byAdding: .month, value: 6, to: .now) ?? .now
    @State private var hasManufactureDate = false
    @State private var manufactureDate = Date.now
    @State private var supplierId: String?
    @State private var poNumber = ""
    @State private var notes = ""
    @State private var working = false
    @State private var error: String?
    @State private var scanningLotNumber = false

    private var current: Item { store.item(id: item.id) ?? item }

    private var assignedOptions: [LocationOption] {
        (current.locations ?? []).map { il in
            let location = store.location(id: il.locationId) ?? il.location
            return LocationOption(id: il.locationId, code: location?.code ?? il.code, path: location?.path ?? "", quantity: il.quantity)
        }
    }

    private var otherOptions: [LocationOption] {
        current.otherOptions(in: store, excluding: Set(assignedOptions.map(\.id)))
    }

    private var selectedOption: LocationOption? {
        (assignedOptions + otherOptions).first { $0.id == locationId }
    }

    private var canSubmit: Bool {
        !lotNumber.trimmingCharacters(in: .whitespaces).isEmpty && quantity > 0 && locationId != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    StockSheetHeader(item: current)
                }

                Section {
                    HStack {
                        TextField("Lot number", text: $lotNumber)
                            .font(.body.monospaced())
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                        Button {
                            scanningLotNumber = true
                        } label: {
                            Image(systemName: "barcode.viewfinder")
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Scan lot number")
                    }
                    Button("Generate lot number") {
                        lotNumber = Self.suggestedLotNumber()
                    }
                    .font(.subheadline)
                } header: {
                    Text("Lot")
                }

                Section {
                    QuantityStepper(value: $quantity, unit: current.unitLabel, tint: .green)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                    NavigationLink {
                        LocationPickerList(
                            title: "Receive into",
                            stocked: assignedOptions,
                            others: otherOptions,
                            selection: $locationId,
                            unit: current.unitLabel
                        )
                    } label: {
                        LocationChoiceRow(label: "Receive into", symbol: "tray.and.arrow.down", option: selectedOption, unit: current.unitLabel)
                    }
                }

                Section("Dates") {
                    Toggle("Expiration date", isOn: $hasExpiry.animation())
                    if hasExpiry {
                        DatePicker("Expires", selection: $expirationDate, displayedComponents: .date)
                    }
                    Toggle("Manufacture date", isOn: $hasManufactureDate.animation())
                    if hasManufactureDate {
                        DatePicker("Made", selection: $manufactureDate, in: ...Date.now, displayedComponents: .date)
                    }
                }

                Section("Source") {
                    Picker("Supplier", selection: $supplierId) {
                        Text("None").tag(String?.none)
                        ForEach(store.suppliers) { supplier in
                            Text(supplier.name).tag(String?.some(supplier.id))
                        }
                    }
                    TextField("PO number", text: $poNumber)
                        .textInputAutocapitalization(.characters)
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(1...4)
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.octagon.fill").foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Receive Lot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                ConfirmBar(
                    title: "Receive \(Format.number(quantity)) \(current.unitLabel)",
                    tint: .green,
                    enabled: canSubmit,
                    working: working,
                    action: submit
                )
            }
            .sheet(isPresented: $scanningLotNumber) {
                SingleCodeScannerSheet(title: "Scan Lot Number") { code in
                    lotNumber = code
                }
            }
            .task {
                if store.locations.isEmpty { try? await store.refreshLocations() }
                if store.suppliers.isEmpty { try? await store.refreshReferenceData() }
                if supplierId == nil { supplierId = current.supplierId }
                if locationId == nil {
                    locationId = assignedOptions.max { ($0.quantity ?? 0) < ($1.quantity ?? 0) }?.id ?? otherOptions.first?.id
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    static func suggestedLotNumber(date: Date = .now) -> String {
        let stamp = DateOnly.string(from: date).replacingOccurrences(of: "-", with: "")
        let suffix = String(UUID().uuidString.prefix(4))
        return "LOT-\(stamp)-\(suffix)"
    }

    private func submit() {
        guard let locationId, canSubmit else { return }
        working = true
        error = nil
        let number = lotNumber.trimmingCharacters(in: .whitespaces)
        let code = selectedOption?.code ?? "location"
        Task {
            do {
                // Lots can only be received into locations the item is assigned to.
                let assignedIds = (current.locations ?? []).map(\.locationId)
                if !assignedIds.contains(locationId) {
                    let updated = try await model.api.updateItem(id: item.id, UpdateItemBody(locationIds: assignedIds + [locationId]))
                    store.apply(updated)
                }
                _ = try await model.api.createLot(itemId: item.id, CreateLotBody(
                    lotNumber: number,
                    quantity: quantity,
                    manufactureDate: hasManufactureDate ? DateOnly.string(from: manufactureDate) : nil,
                    expirationDate: hasExpiry ? DateOnly.string(from: expirationDate) : nil,
                    supplierId: supplierId,
                    poNumber: poNumber.isEmpty ? nil : poNumber,
                    notes: notes.isEmpty ? nil : notes,
                    locationAssignments: [.init(locationId: locationId, quantity: quantity)]
                ))
                await store.reload(itemId: item.id)
                Haptics.success()
                onComplete("Received lot \(number) · \(Format.number(quantity)) \(current.unitLabel) into \(code)")
                dismiss()
            } catch {
                self.error = error.localizedDescription
                Haptics.error()
            }
            working = false
        }
    }
}
