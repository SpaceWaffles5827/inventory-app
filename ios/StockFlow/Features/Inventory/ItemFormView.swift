import SwiftUI
import PhotosUI

/// Create or edit an item.
struct ItemFormView: View {
    enum Mode {
        case create(barcode: String?)
        case edit(Item)
    }

    @Environment(AppModel.self) private var model
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let mode: Mode
    let onSaved: (Item) -> Void

    @State private var name = ""
    @State private var barcode = ""
    @State private var unit = "EA"
    @State private var costText = ""
    @State private var reorderPoint = 10
    @State private var categoryId: String?
    @State private var supplierId: String?
    @State private var description = ""
    @State private var initialQuantity = 0
    @State private var locationId: String?
    @State private var lotTracking = false
    @State private var photo: UIImage?
    @State private var photoItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var scanningBarcode = false
    @State private var newCategoryName = ""
    @State private var newSupplierName = ""
    @State private var addingCategory = false
    @State private var addingSupplier = false
    @State private var working = false
    @State private var error: String?
    @State private var loaded = false
    @FocusState private var nameFocused: Bool

    private static let units = ["EA", "BOX", "CASE", "PACK", "ROLL", "PAIR", "SET", "KG", "LB", "L", "M", "FT"]

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private var editingItem: Item? {
        if case .edit(let item) = mode { return store.item(id: item.id) ?? item }
        return nil
    }

    private var cost: Double? {
        let cleaned = costText.replacingOccurrences(of: "$", with: "").replacingOccurrences(of: ",", with: "")
        return cleaned.isEmpty ? nil : Double(cleaned)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && (costText.isEmpty || cost != nil)
            && (initialQuantity == 0 || locationId != nil)
            && !working
    }

    var body: some View {
        NavigationStack {
            Form {
                if !isEditing {
                    photoSection
                }

                Section("Item") {
                    TextField("Name", text: $name)
                        .font(.headline)
                        .focused($nameFocused)
                    HStack {
                        TextField("Barcode (optional)", text: $barcode)
                            .font(.body.monospaced())
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        Button {
                            scanningBarcode = true
                        } label: {
                            Image(systemName: "barcode.viewfinder")
                                .font(.title3)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Scan barcode")
                    }
                    Picker("Unit", selection: $unit) {
                        ForEach(unitOptions, id: \.self) { Text($0).tag($0) }
                    }
                }

                Section("Stock settings") {
                    HStack {
                        Text("Unit cost")
                        Spacer()
                        TextField("$0.00", text: $costText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 140)
                            .foregroundStyle(cost == nil && !costText.isEmpty ? .red : .primary)
                    }
                    Stepper(value: $reorderPoint, in: 0...1_000_000) {
                        HStack {
                            Text("Reorder point")
                            Spacer()
                            Text("\(reorderPoint)").monospacedDigit().foregroundStyle(.secondary)
                        }
                    }
                    if isEditing && model.role >= .admin {
                        Toggle("Lot tracking", isOn: $lotTracking)
                    }
                }

                if !isEditing {
                    Section {
                        Stepper(value: $initialQuantity, in: 0...1_000_000) {
                            HStack {
                                Text("Starting quantity")
                                Spacer()
                                Text("\(initialQuantity)").monospacedDigit().foregroundStyle(.secondary)
                            }
                        }
                        Picker("Location", selection: $locationId) {
                            Text("None").tag(String?.none)
                            ForEach(store.locations) { location in
                                Text(location.code).tag(String?.some(location.id))
                            }
                        }
                    } header: {
                        Text("Starting stock")
                    } footer: {
                        if initialQuantity > 0 && locationId == nil {
                            Text("Choose where the starting stock is stored.").foregroundStyle(.red)
                        }
                    }
                }

                Section("Organize") {
                    Picker("Category", selection: $categoryId) {
                        Text("None").tag(String?.none)
                        ForEach(store.categories) { Text($0.name).tag(String?.some($0.id)) }
                    }
                    Button("New category…") { addingCategory = true }
                    Picker("Supplier", selection: $supplierId) {
                        Text("None").tag(String?.none)
                        ForEach(store.suppliers) { Text($0.name).tag(String?.some($0.id)) }
                    }
                    Button("New supplier…") { addingSupplier = true }
                }

                Section("Description") {
                    TextField("Notes, specs, storage instructions…", text: $description, axis: .vertical)
                        .lineLimit(3...8)
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.octagon.fill").foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Item" : "New Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if working {
                        ProgressView()
                    } else {
                        Button(isEditing ? "Save" : "Create", action: save)
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .sheet(isPresented: $scanningBarcode) {
                SingleCodeScannerSheet(title: "Scan Barcode") { code in barcode = code }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { photo = $0 }.ignoresSafeArea()
            }
            .onChange(of: photoItem) { _, newValue in
                guard let newValue else { return }
                Task {
                    if let data = try? await newValue.loadTransferable(type: Data.self) { photo = UIImage(data: data) }
                    photoItem = nil
                }
            }
            .alert("New Category", isPresented: $addingCategory) {
                TextField("Name", text: $newCategoryName)
                Button("Cancel", role: .cancel) { newCategoryName = "" }
                Button("Add") { Task { await createCategory() } }
            }
            .alert("New Supplier", isPresented: $addingSupplier) {
                TextField("Name", text: $newSupplierName)
                Button("Cancel", role: .cancel) { newSupplierName = "" }
                Button("Add") { Task { await createSupplier() } }
            }
            .task {
                guard !loaded else { return }
                loaded = true
                populate()
                if store.categories.isEmpty || store.suppliers.isEmpty { try? await store.refreshReferenceData() }
                if store.locations.isEmpty { try? await store.refreshLocations() }
                if !isEditing && name.isEmpty { nameFocused = true }
            }
        }
        .interactiveDismissDisabled(working)
    }

    private var unitOptions: [String] {
        Self.units.contains(unit) ? Self.units : [unit] + Self.units
    }

    @ViewBuilder private var photoSection: some View {
        Section {
            HStack(spacing: 16) {
                ZStack {
                    if let photo {
                        Image(uiImage: photo).resizable().scaledToFill()
                    } else {
                        Image(systemName: "photo")
                            .font(.title)
                            .foregroundStyle(.tertiary)
                    }
                }
                .frame(width: 76, height: 76)
                .background(Color(.tertiarySystemFill))
                .clipShape(.rect(cornerRadius: 18, style: .continuous))

                VStack(alignment: .leading, spacing: 10) {
                    Button {
                        showCamera = true
                    } label: {
                        Label("Take Photo", systemImage: "camera")
                    }
                    .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("Choose from Library", systemImage: "photo.on.rectangle")
                    }
                }
                .buttonStyle(.borderless)
            }
            .padding(.vertical, 4)
        }
    }

    private func populate() {
        switch mode {
        case .create(let code):
            barcode = code ?? ""
            locationId = nil
        case .edit(let original):
            let item = store.item(id: original.id) ?? original
            name = item.name
            barcode = item.barcode ?? ""
            unit = item.unit?.isEmpty == false ? item.unit! : "EA"
            costText = item.cost == 0 ? "" : String(format: "%.2f", item.cost)
            reorderPoint = item.reorderPoint
            categoryId = item.categoryId
            supplierId = item.supplierId
            description = item.description ?? ""
            lotTracking = item.lotTracking
        }
    }

    private func save() {
        guard canSave, let workspaceId = model.workspace?.id else { return }
        working = true
        error = nil
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let trimmedBarcode = barcode.trimmingCharacters(in: .whitespaces)
        Task {
            do {
                let saved: Item
                if let existing = editingItem {
                    saved = try await model.api.updateItem(id: existing.id, UpdateItemBody(
                        name: trimmedName,
                        barcode: trimmedBarcode,
                        unit: unit,
                        description: description,
                        cost: cost ?? 0,
                        reorderPoint: reorderPoint,
                        categoryId: categoryId ?? "",
                        supplierId: supplierId ?? "",
                        lotTracking: lotTracking != existing.lotTracking ? lotTracking : nil
                    ))
                } else {
                    saved = try await model.api.createItem(CreateItemBody(
                        workspaceId: workspaceId,
                        name: trimmedName,
                        barcode: trimmedBarcode.isEmpty ? nil : trimmedBarcode,
                        unit: unit,
                        description: description.isEmpty ? nil : description,
                        onHand: initialQuantity > 0 ? initialQuantity : nil,
                        cost: cost,
                        reorderPoint: reorderPoint,
                        categoryId: categoryId,
                        supplierId: supplierId,
                        locationIds: locationId.map { [$0] }
                    ))
                    if let photo, let data = photo.preparedForUpload() {
                        _ = try? await model.api.uploadImage(itemId: saved.id, jpeg: data, isPrimary: true)
                    }
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

    private func createCategory() async {
        let trimmed = newCategoryName.trimmingCharacters(in: .whitespaces)
        newCategoryName = ""
        guard !trimmed.isEmpty, let workspaceId = model.workspace?.id else { return }
        do {
            let category = try await model.api.createCategory(workspaceId: workspaceId, name: trimmed)
            store.add(category)
            categoryId = category.id
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func createSupplier() async {
        let trimmed = newSupplierName.trimmingCharacters(in: .whitespaces)
        newSupplierName = ""
        guard !trimmed.isEmpty, let workspaceId = model.workspace?.id else { return }
        do {
            let supplier = try await model.api.createSupplier(workspaceId: workspaceId, name: trimmed)
            store.add(supplier)
            supplierId = supplier.id
        } catch {
            self.error = error.localizedDescription
        }
    }
}
