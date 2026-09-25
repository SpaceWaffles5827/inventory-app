import SwiftUI

struct LocationsView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store

    @State private var search = ""
    @State private var creating = false
    @State private var error: String?
    @State private var groupByZone = true

    private var filtered: [Location] {
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return store.locations }
        return store.locations.filter {
            $0.code.localizedCaseInsensitiveContains(query)
                || $0.path.localizedCaseInsensitiveContains(query)
                || ($0.description?.localizedCaseInsensitiveContains(query) ?? false)
                || ($0.barcode?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    /// Groups by the first structure level (e.g. Zone A, Zone B).
    private var groups: [(title: String, locations: [Location])] {
        guard groupByZone else { return [("", filtered)] }
        let grouped = Dictionary(grouping: filtered) { location -> String in
            guard let first = location.structure.first, !first.value.isEmpty else { return "Other" }
            return "\(first.label) \(first.value)"
        }
        return grouped.keys.sorted { $0.localizedStandardCompare($1) == .orderedAscending }.map { ($0, grouped[$0]!) }
    }

    private var totalUnits: Int { store.locations.reduce(0) { $0 + ($1.totalUnits ?? 0) } }

    var body: some View {
        @Bindable var router = router

        NavigationStack(path: $router.locationsPath) {
            List {
                if store.hasLoadedLocations && !store.locations.isEmpty && search.isEmpty {
                    Section {
                        HStack(spacing: 12) {
                            summaryTile(value: Format.number(store.locations.count), label: "Locations", symbol: "mappin.and.ellipse", tint: .accentColor)
                            summaryTile(value: Format.compact(totalUnits), label: "Units stored", symbol: "cube.box.fill", tint: .teal)
                        }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                }

                if let error, store.locations.isEmpty {
                    ErrorBanner(message: error) { Task { await refresh() } }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                ForEach(groups, id: \.title) { group in
                    Section(group.title) {
                        ForEach(group.locations) { location in
                            NavigationLink(value: LocationRoute(id: location.id)) {
                                LocationRow(location: location)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .overlay {
                if !store.hasLoadedLocations && error == nil {
                    ProgressView()
                } else if store.hasLoadedLocations && store.locations.isEmpty {
                    ContentUnavailableView {
                        Label("No Locations", systemImage: "mappin.slash")
                    } description: {
                        Text("Locations are the shelves, bins and zones where stock lives.")
                    } actions: {
                        Button("Add Location") { creating = true }
                            .buttonStyle(.borderedProminent)
                    }
                } else if filtered.isEmpty && !search.isEmpty {
                    ContentUnavailableView.search(text: search)
                }
            }
            .navigationTitle("Locations")
            .searchable(text: $search, prompt: "Code, zone or barcode")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        Toggle("Group by zone", systemImage: "square.stack.3d.up", isOn: $groupByZone)
                        Button("Scan a Location", systemImage: "barcode.viewfinder") { router.openScanner(mode: .find) }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    Button {
                        creating = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("New location")
                }
            }
            .refreshable { await refresh() }
            .sheet(isPresented: $creating) {
                LocationFormView(location: nil) { location in
                    router.locationsPath.append(LocationRoute(id: location.id))
                }
            }
            .appDestinations()
        }
    }

    private func summaryTile(value: String, label: String, symbol: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(tint.gradient, in: .rect(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 0) {
                Text(value).font(.title3.bold()).fontDesign(.rounded)
                Text(label).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .card(padding: 12)
    }

    private func refresh() async {
        do {
            try await store.refreshLocations()
            error = nil
        } catch is CancellationError {
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct LocationRow: View {
    let location: Location

    var body: some View {
        HStack(spacing: 12) {
            UtilizationRing(fraction: location.utilization ?? 0)
                .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(location.code)
                    .font(.body.weight(.semibold))
                Text(location.description?.isEmpty == false ? location.description! : location.path)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(Format.number(location.totalUnits ?? 0))
                    .font(.headline.monospacedDigit())
                Text("\(location.itemCount) \(location.itemCount == 1 ? "item" : "items")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

/// How full a location is relative to its capacity.
struct UtilizationRing: View {
    let fraction: Double

    private var color: Color {
        switch fraction {
        case ..<0.01: .secondary
        case ..<0.75: .accentColor
        case ..<0.95: .orange
        default: .red
        }
    }

    var body: some View {
        ZStack {
            Circle().stroke(Color(.tertiarySystemFill), lineWidth: 4)
            Circle()
                .trim(from: 0, to: min(1, fraction))
                .stroke(color, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int((min(fraction, 9.99) * 100).rounded()))%")
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .foregroundStyle(.secondary)
        }
        .accessibilityLabel("\(Int(fraction * 100)) percent full")
    }
}
