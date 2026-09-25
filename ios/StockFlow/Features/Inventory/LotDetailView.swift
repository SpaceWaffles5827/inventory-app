import SwiftUI

struct LotDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store

    let lotId: String

    @State private var lot: Lot?
    @State private var error: String?
    @State private var stockAction: StockAction?
    @State private var toast: Toast?
    @State private var updatingStatus = false

    private var item: Item? { lot.flatMap { store.item(id: $0.itemId) } }

    var body: some View {
        Group {
            if let lot {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(lot.lotNumber)
                                    .font(.title2.bold().monospaced())
                                Spacer()
                                Pill(text: lot.status.title, color: lot.status.color)
                            }
                            if let name = item?.name ?? lot.item?.name {
                                Text(name).foregroundStyle(.secondary)
                            }
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text(Format.number(lot.quantity))
                                    .font(.system(size: 40, weight: .bold, design: .rounded))
                                Text("of \(Format.number(lot.initialQuantity)) received")
                                    .foregroundStyle(.secondary)
                            }
                            if let days = lot.daysUntilExpiry {
                                Label(Format.expiry(days: days), systemImage: "calendar.badge.clock")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(days < 0 ? .red : days <= 30 ? .orange : .secondary)
                            }
                        }
                        .padding(.vertical, 6)
                    }

                    if let item {
                        Section {
                            HStack(spacing: 10) {
                                Button("Add", systemImage: "plus") { stockAction = .adjust(item, .input) }
                                    .tint(.green)
                                Button("Remove", systemImage: "minus") { stockAction = .adjust(item, .output) }
                                    .tint(.red)
                                    .disabled(lot.quantity == 0)
                                Button("Move", systemImage: "arrow.left.arrow.right") { stockAction = .transfer(item) }
                                    .tint(.blue)
                                    .disabled(lot.quantity == 0)
                            }
                            .buttonStyle(.bordered)
                            .frame(maxWidth: .infinity)
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                    }

                    Section("Locations") {
                        if lot.stockedLocations.isEmpty {
                            Text("No stock left in this lot.").foregroundStyle(.secondary)
                        }
                        ForEach(lot.stockedLocations) { ll in
                            NavigationLink(value: LocationRoute(id: ll.locationId)) {
                                HStack {
                                    Label(ll.code, systemImage: "mappin")
                                    Spacer()
                                    Text(Format.number(ll.quantity)).monospacedDigit()
                                }
                            }
                        }
                    }

                    Section("Details") {
                        LabeledContent("Received", value: lot.receivedDate?.formatted(date: .abbreviated, time: .omitted) ?? "—")
                        LabeledContent("Manufactured", value: lot.manufactureDay?.formatted(date: .abbreviated, time: .omitted) ?? "—")
                        LabeledContent("Expires", value: lot.expiryDay?.formatted(date: .abbreviated, time: .omitted) ?? "—")
                        LabeledContent("Supplier", value: lot.supplier?.name ?? "—")
                        LabeledContent("PO number", value: lot.poNumber ?? "—")
                        LabeledContent("Received by", value: lot.creator?.displayName ?? "—")
                        if let notes = lot.notes, !notes.isEmpty {
                            Text(notes).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }

                    if !lot.isSystem {
                        Section {
                            Menu {
                                ForEach(LotStatus.allCases, id: \.self) { status in
                                    Button {
                                        Task { await setStatus(status) }
                                    } label: {
                                        if status == lot.status { Label(status.title, systemImage: "checkmark") } else { Text(status.title) }
                                    }
                                }
                            } label: {
                                HStack {
                                    Text("Status")
                                    Spacer()
                                    if updatingStatus { ProgressView() } else { Text(lot.status.title).foregroundStyle(.secondary) }
                                }
                            }
                        } footer: {
                            Text("Quarantined and recalled lots stay in stock but are flagged when picking.")
                        }
                    }

                    Section("History") {
                        TransactionFeedInline(lotId: lot.id)
                    }
                }
                .navigationTitle("Lot \(lot.lotNumber)")
            } else if let error {
                ContentUnavailableView("Couldn't Load Lot", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                ProgressView()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: store.revision) { await load() }
        .refreshable { await load() }
        .stockActionSheet($stockAction) { toast = Toast(message: $0) }
        .toast($toast)
    }

    private func load() async {
        do {
            lot = try await model.api.lot(id: lotId)
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func setStatus(_ status: LotStatus) async {
        updatingStatus = true
        defer { updatingStatus = false }
        do {
            lot = try await model.api.updateLotStatus(id: lotId, status: status)
            Haptics.success()
        } catch {
            toast = Toast(message: error.localizedDescription, style: .error)
        }
    }
}

/// A few recent movements for a lot, shown inside a List section.
private struct TransactionFeedInline: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store
    let lotId: String
    @State private var transactions: [StockTransaction] = []

    var body: some View {
        Group {
            if transactions.isEmpty {
                Text("No movements yet.").foregroundStyle(.secondary)
            }
            ForEach(transactions) { transaction in
                TransactionRow(transaction: transaction, showItem: false)
            }
        }
        .task(id: store.revision) {
            guard let workspaceId = model.workspace?.id else { return }
            transactions = (try? await model.api.transactions(workspaceId: workspaceId, TransactionQuery(lotId: lotId, limit: 20)))?.transactions ?? []
        }
    }
}
