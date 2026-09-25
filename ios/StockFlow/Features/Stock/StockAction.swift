import SwiftUI

/// A stock operation to present as a sheet.
enum StockAction: Identifiable {
    case adjust(Item, StockDirection, locationId: String? = nil)
    case transfer(Item, fromLocationId: String? = nil, toLocationId: String? = nil)
    case receiveLot(Item)

    var id: String {
        switch self {
        case .adjust(let item, let direction, let location): "adjust-\(item.id)-\(direction.rawValue)-\(location ?? "")"
        case .transfer(let item, let from, let to): "transfer-\(item.id)-\(from ?? "")-\(to ?? "")"
        case .receiveLot(let item): "lot-\(item.id)"
        }
    }
}

extension View {
    /// Presents adjust / transfer / receive sheets; `onComplete` receives a confirmation message.
    func stockActionSheet(_ action: Binding<StockAction?>, onComplete: @escaping (String) -> Void) -> some View {
        sheet(item: action) { action in
            switch action {
            case .adjust(let item, let direction, let locationId):
                AdjustStockSheet(item: item, direction: direction, preferredLocationId: locationId, onComplete: onComplete)
            case .transfer(let item, let from, let to):
                TransferStockSheet(item: item, preferredFromId: from, preferredToId: to, onComplete: onComplete)
            case .receiveLot(let item):
                ReceiveLotSheet(item: item, onComplete: onComplete)
            }
        }
    }
}

// MARK: - Location choice

struct LocationOption: Identifiable, Hashable {
    let id: String
    let code: String
    let path: String
    /// Units of the item (or lot) stored here, when relevant.
    let quantity: Int?
}

/// Searchable list for choosing a location, with the ones that hold the item on top.
struct LocationPickerList: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let stocked: [LocationOption]
    let others: [LocationOption]
    @Binding var selection: String?
    var unit: String = "units"

    @State private var search = ""

    private func filtered(_ options: [LocationOption]) -> [LocationOption] {
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return options }
        return options.filter {
            $0.code.localizedCaseInsensitiveContains(query) || $0.path.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        List {
            let stockedMatches = filtered(stocked)
            let otherMatches = filtered(others)
            if !stockedMatches.isEmpty {
                Section("Holds this item") {
                    ForEach(stockedMatches) { row($0) }
                }
            }
            if !otherMatches.isEmpty {
                Section(stocked.isEmpty ? "Locations" : "Other locations") {
                    ForEach(otherMatches) { row($0) }
                }
            }
        }
        .overlay {
            if filtered(stocked).isEmpty && filtered(others).isEmpty {
                ContentUnavailableView.search(text: search)
            }
        }
        .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search locations")
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ option: LocationOption) -> some View {
        Button {
            selection = option.id
            Haptics.selection()
            dismiss()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.code)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                    if !option.path.isEmpty {
                        Text(option.path)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if let quantity = option.quantity {
                    Text("\(Format.number(quantity)) \(unit)")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                if selection == option.id {
                    Image(systemName: "checkmark")
                        .fontWeight(.semibold)
                        .foregroundStyle(.tint)
                }
            }
            .contentShape(.rect)
        }
    }
}

/// Row that shows the chosen location and pushes the picker.
struct LocationChoiceRow: View {
    let label: String
    let symbol: String
    let option: LocationOption?
    var unit: String = "units"

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(.tint)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(option?.code ?? "Choose location")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(option == nil ? .secondary : .primary)
            }
            Spacer()
            if let quantity = option?.quantity {
                Text("\(Format.number(quantity)) \(unit)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .contentShape(.rect)
    }
}

// MARK: - Header shared by the sheets

struct StockSheetHeader: View {
    let item: Item

    var body: some View {
        HStack(spacing: 14) {
            ItemThumbnail(itemId: item.id, name: item.name, size: 52)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name)
                    .font(.headline)
                    .lineLimit(2)
                Text("\(item.itemNumber) · \(Format.number(item.onHand)) \(item.unitLabel) on hand")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
    }
}

/// Big full-width confirm button pinned above the keyboard / home indicator.
struct ConfirmBar: View {
    let title: String
    var tint: Color = .accentColor
    var enabled = true
    var working = false
    var footnote: String?
    let action: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            if let footnote {
                Text(footnote)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .transition(.opacity)
            }
            Button(action: action) {
                ZStack {
                    Text(title).opacity(working ? 0 : 1)
                    if working { ProgressView().tint(.white) }
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .prominentGlassButton()
            .tint(tint)
            .controlSize(.large)
            .disabled(!enabled || working)
        }
        .padding(.horizontal)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(.bar)
    }
}

@MainActor
extension Item {
    /// Options for locations that hold this item, largest quantity first.
    func stockedOptions(in store: InventoryStore) -> [LocationOption] {
        stockedLocations.map { il in
            let location = store.location(id: il.locationId) ?? il.location
            return LocationOption(id: il.locationId, code: location?.code ?? il.code, path: location?.path ?? "", quantity: il.quantity)
        }
    }

    /// Every other location in the workspace.
    func otherOptions(in store: InventoryStore, excluding: Set<String>) -> [LocationOption] {
        store.locations
            .filter { !excluding.contains($0.id) }
            .map { LocationOption(id: $0.id, code: $0.code, path: $0.path, quantity: nil) }
    }
}
