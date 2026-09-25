import SwiftUI

/// Create or edit a location. Structure levels follow the workspace template (Zone / Aisle / Shelf / Bin).
struct LocationFormView: View {
    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let location: Location?
    let onSaved: (Location) -> Void

    @State private var code = ""
    @State private var codeEdited = false
    @State private var barcode = ""
    @State private var levels: [LevelField] = []
    @State private var capacity = 100
    @State private var description = ""
    @State private var working = false
    @State private var error: String?
    @State private var loaded = false
    @State private var scanningBarcode = false

    struct LevelField: Identifiable {
        let id = UUID()
        var label: String
        var value: String
    }

    /// "A-01-1-1" from the level values, used until the user types their own code.
    private var suggestedCode: String {
        levels.map { $0.value.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: "-")
    }

    private var canSave: Bool {
        !code.trimmingCharacters(in: .whitespaces).isEmpty && !levels.isEmpty && !working
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach($levels) { $level in
                        HStack {
                            Text(level.label)
                                .foregroundStyle(.secondary)
                                .frame(width: 90, alignment: .leading)
                            TextField(level.label, text: $level.value)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                        }
                    }
                } header: {
                    Text("Position")
                } footer: {
                    Text("Levels come from your workspace's location template.")
                }

                Section("Identity") {
                    HStack {
                        Text("Code").foregroundStyle(.secondary).frame(width: 90, alignment: .leading)
                        TextField(suggestedCode.isEmpty ? "A-01-01" : suggestedCode, text: Binding(
                            get: { code },
                            set: { code = $0; codeEdited = true }
                        ))
                        .font(.body.monospaced())
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    }
                    HStack {
                        Text("Barcode").foregroundStyle(.secondary).frame(width: 90, alignment: .leading)
                        TextField("Auto (LOC-\(code.isEmpty ? "CODE" : code))", text: $barcode)
                            .font(.body.monospaced())
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        Button {
                            scanningBarcode = true
                        } label: {
                            Image(systemName: "barcode.viewfinder")
                        }
                        .buttonStyle(.borderless)
                    }
                }

                Section("Details") {
                    Stepper(value: $capacity, in: 0...1_000_000, step: 10) {
                        HStack {
                            Text("Capacity")
                            Spacer()
                            Text("\(capacity) units").monospacedDigit().foregroundStyle(.secondary)
                        }
                    }
                    TextField("Description", text: $description)
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.octagon.fill").foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(location == nil ? "New Location" : "Edit Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if working {
                        ProgressView()
                    } else {
                        Button(location == nil ? "Create" : "Save", action: save)
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .onChange(of: suggestedCode) { _, suggestion in
                if !codeEdited && location == nil { code = suggestion }
            }
            .sheet(isPresented: $scanningBarcode) {
                SingleCodeScannerSheet(title: "Scan Label") { barcode = $0 }
            }
            .task {
                guard !loaded else { return }
                loaded = true
                await populate()
            }
        }
    }

    private func populate() async {
        if let location {
            code = location.code
            codeEdited = true
            barcode = location.barcode ?? ""
            levels = location.structure.map { LevelField(label: $0.label, value: $0.value) }
            capacity = location.capacity
            description = location.description ?? ""
        }
        if levels.isEmpty {
            let template = (try? await model.api.locationTemplate(workspaceId: model.workspace?.id ?? ""))?.levels.map(\.label)
            let labels = (template?.isEmpty == false ? template! : ["Zone", "Aisle", "Shelf", "Bin"])
            levels = labels.map { LevelField(label: $0, value: "") }
        }
    }

    private func save() {
        guard canSave, let workspaceId = model.workspace?.id else { return }
        working = true
        error = nil
        let body = LocationBody(
            workspaceId: workspaceId,
            code: code.trimmingCharacters(in: .whitespaces),
            barcode: barcode.trimmingCharacters(in: .whitespaces).isEmpty ? nil : barcode.trimmingCharacters(in: .whitespaces),
            structure: levels.map { .init(label: $0.label, value: $0.value.trimmingCharacters(in: .whitespaces)) },
            capacity: capacity,
            description: description.isEmpty ? nil : description
        )
        Task {
            do {
                let saved: Location
                if let location {
                    saved = try await model.api.updateLocation(id: location.id, body)
                } else {
                    saved = try await model.api.createLocation(body)
                }
                store.apply(saved)
                try? await store.refreshLocations()
                Haptics.success()
                onSaved(saved)
                dismiss()
            } catch {
                self.error = error.localizedDescription
                Haptics.error()
            }
            working = false
        }
    }
}
