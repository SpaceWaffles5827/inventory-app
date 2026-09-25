import SwiftUI
import PhotosUI

struct ItemDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let itemId: String

    @State private var fetched: Item?
    @State private var images: [ItemImage] = []
    @State private var lots: [Lot] = []
    @State private var history: [StockTransaction] = []
    @State private var error: String?
    @State private var stockAction: StockAction?
    @State private var toast: Toast?
    @State private var editing = false
    @State private var showLabel = false
    @State private var confirmDelete = false
    @State private var photoItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var uploading = false
    @State private var thumbnailToken = 0

    private var item: Item? { store.item(id: itemId) ?? fetched }

    var body: some View {
        Group {
            if let item {
                content(item)
            } else if let error {
                ContentUnavailableView {
                    Label("Couldn't Load Item", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Try Again") { Task { await load() } }
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .task(id: store.revision) { await load() }
        .stockActionSheet($stockAction) { message in
            toast = Toast(message: message)
        }
        .toast($toast)
    }

    // MARK: Content

    private func content(_ item: Item) -> some View {
        let status = ItemStatus.derive(onHand: item.onHand, reorderPoint: item.reorderPoint)
        return ScrollView {
            VStack(spacing: 20) {
                gallery(item)

                VStack(spacing: 6) {
                    Text(item.name)
                        .font(.title2.bold())
                        .multilineTextAlignment(.center)
                    HStack(spacing: 8) {
                        Text(item.itemNumber)
                            .font(.subheadline.monospaced())
                            .foregroundStyle(.secondary)
                        StatusBadge(status: status)
                    }
                }
                .padding(.horizontal)

                stockCard(item, status: status)
                actionBar(item)

                if !item.stockedLocations.isEmpty || !(item.locations ?? []).isEmpty {
                    locationsSection(item)
                }

                if item.lotTracking {
                    lotsSection(item)
                }

                detailsSection(item)

                historySection(item)
            }
            .padding(.bottom, 32)
        }
        .refreshable {
            await store.reload(itemId: itemId)
            await load()
        }
        .navigationTitle(item.name)
        .toolbar { toolbar(item) }
        .sheet(isPresented: $editing) {
            ItemFormView(mode: .edit(item)) { _ in editing = false }
        }
        .sheet(isPresented: $showLabel) {
            CodeLabelSheet(title: item.name, subtitle: item.itemNumber, value: item.barcode ?? item.itemNumber)
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                Task { await upload(image) }
            }
            .ignoresSafeArea()
        }
        .onChange(of: photoItem) { _, newValue in
            guard let newValue else { return }
            Task {
                if let data = try? await newValue.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    await upload(image)
                }
                photoItem = nil
            }
        }
        .confirmationDialog("Delete \(item.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete Item", role: .destructive) { Task { await delete() } }
        } message: {
            Text("This removes the item, its lots and its entire stock history. This can't be undone.")
        }
    }

    @ToolbarContentBuilder
    private func toolbar(_ item: Item) -> some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("Edit Item", systemImage: "pencil") { editing = true }
                Button("Show Label", systemImage: "qrcode") { showLabel = true }
                Section("Photos") {
                    Button("Take Photo", systemImage: "camera") { showCamera = true }
                        .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("Choose Photo", systemImage: "photo.on.rectangle")
                    }
                }
                if let barcode = item.barcode {
                    Button("Copy Barcode", systemImage: "doc.on.doc") {
                        UIPasteboard.general.string = barcode
                        toast = Toast(message: "Barcode copied", symbol: "doc.on.doc.fill")
                    }
                }
                ShareLink(item: shareText(item)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
                if model.canDelete {
                    Divider()
                    Button("Delete Item", systemImage: "trash", role: .destructive) { confirmDelete = true }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityLabel("More actions")
        }
    }

    private func gallery(_ item: Item) -> some View {
        ZStack {
            if images.isEmpty {
                VStack(spacing: 12) {
                    Monogram(name: item.name, size: 96)
                        .clipShape(.rect(cornerRadius: 26, style: .continuous))
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label(uploading ? "Uploading…" : "Add Photo", systemImage: "camera.fill")
                            .font(.subheadline.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .disabled(uploading)
                }
                .padding(.vertical, 12)
            } else {
                TabView {
                    ForEach(images) { image in
                        RemoteImage(imageId: image.id)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .clipped()
                            .contextMenu {
                                if !image.isPrimary {
                                    Button("Make Cover Photo", systemImage: "star") { Task { await makePrimary(image) } }
                                }
                                if model.canDelete {
                                    Button("Delete Photo", systemImage: "trash", role: .destructive) {
                                        Task { await deleteImage(image) }
                                    }
                                }
                            }
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: images.count > 1 ? .always : .never))
                .frame(height: 280)
                .clipShape(.rect(cornerRadius: 24, style: .continuous))
                .padding(.horizontal)
                .overlay(alignment: .bottomTrailing) {
                    if uploading {
                        ProgressView()
                            .padding(10)
                            .glassCircle()
                            .padding(24)
                    }
                }
            }
        }
    }

    private func stockCard(_ item: Item, status: ItemStatus) -> some View {
        VStack(spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("On hand")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(Format.number(item.onHand))
                            .font(.system(size: 44, weight: .bold, design: .rounded))
                            .contentTransition(.numericText(value: Double(item.onHand)))
                        Text(item.unitLabel)
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Value")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(Format.currency(item.value))
                        .font(.title3.weight(.semibold))
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                StockGauge(onHand: item.onHand, reorderPoint: item.reorderPoint)
                HStack {
                    Text("Reorder at \(Format.number(item.reorderPoint))")
                    Spacer()
                    if status != .inStock {
                        Text(status == .outOfStock ? "Restock now" : "Running low")
                            .foregroundStyle(status.color)
                            .fontWeight(.semibold)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
        .card()
        .padding(.horizontal)
        .animation(.snappy, value: item.onHand)
    }

    private func actionBar(_ item: Item) -> some View {
        HStack(spacing: 10) {
            DetailAction(title: "Add", symbol: "plus", tint: .green) {
                stockAction = .adjust(item, .input)
            }
            DetailAction(title: "Remove", symbol: "minus", tint: .red) {
                stockAction = .adjust(item, .output)
            }
            .disabled(item.onHand <= 0)
            DetailAction(title: "Move", symbol: "arrow.left.arrow.right", tint: .blue) {
                stockAction = .transfer(item)
            }
            .disabled(item.onHand <= 0)
            if item.lotTracking {
                DetailAction(title: "Receive lot", symbol: "shippingbox.and.arrow.backward", tint: .teal) {
                    stockAction = .receiveLot(item)
                }
            }
        }
        .padding(.horizontal)
    }

    private func locationsSection(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Stock by location")
                .padding(.horizontal)
            let rows = (item.locations ?? []).sorted { $0.quantity > $1.quantity }
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, il in
                    if index > 0 { Divider().padding(.leading, 56) }
                    NavigationLink(value: LocationRoute(id: il.locationId)) {
                        HStack(spacing: 12) {
                            Image(systemName: "mappin.circle.fill")
                                .font(.title2)
                                .foregroundStyle(il.quantity > 0 ? Color.accentColor : Color.secondary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(il.code).font(.body.weight(.semibold))
                                if let path = (store.location(id: il.locationId) ?? il.location)?.path, !path.isEmpty {
                                    Text(path).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Text(Format.number(il.quantity))
                                .font(.headline.monospacedDigit())
                                .foregroundStyle(il.quantity > 0 ? .primary : .secondary)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button("Add Here", systemImage: "plus") { stockAction = .adjust(item, .input, locationId: il.locationId) }
                        if il.quantity > 0 {
                            Button("Remove From Here", systemImage: "minus") { stockAction = .adjust(item, .output, locationId: il.locationId) }
                            Button("Move From Here", systemImage: "arrow.left.arrow.right") { stockAction = .transfer(item, fromLocationId: il.locationId) }
                        }
                    }
                }
            }
            .card(padding: 0)
            .padding(.horizontal)
        }
    }

    private func lotsSection(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Lots") {
                Button("Receive") { stockAction = .receiveLot(item) }
            }
            .padding(.horizontal)
            let visible = lots.filter { !($0.isSystem && $0.quantity == 0) }
            if visible.isEmpty {
                Text("No lots received yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                    .padding(.horizontal)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(visible.enumerated()), id: \.element.id) { index, lot in
                        if index > 0 { Divider().padding(.leading, 14) }
                        NavigationLink(value: LotRoute(id: lot.id)) {
                            LotRow(lot: lot, unit: item.unitLabel)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .card(padding: 0)
                .padding(.horizontal)
            }
        }
    }

    private func detailsSection(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Details")
                .padding(.horizontal)
            VStack(spacing: 0) {
                if let barcode = item.barcode, !barcode.isEmpty {
                    Button { showLabel = true } label: {
                        VStack(spacing: 8) {
                            CodeImage(value: barcode, kind: .barcode)
                                .frame(height: 64)
                                .padding(.horizontal, 24)
                                .padding(.vertical, 10)
                                .background(.white, in: .rect(cornerRadius: 12))
                            Text(barcode)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(14)
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
                DetailRow(label: "Unit cost", value: Format.currency(item.cost))
                DetailRow(label: "Unit", value: item.unit ?? "—")
                DetailRow(label: "Category", value: item.category?.name ?? "—")
                DetailRow(label: "Supplier", value: item.supplier?.name ?? "—")
                DetailRow(label: "Lot tracking", value: item.lotTracking ? "On" : "Off")
                DetailRow(label: "Updated", value: item.updatedAt.formatted(date: .abbreviated, time: .shortened), last: item.description?.isEmpty ?? true)
                if let description = item.description, !description.isEmpty {
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                }
            }
            .card(padding: 0)
            .padding(.horizontal)
        }
    }

    private func historySection(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "History") {
                NavigationLink("See all") {
                    TransactionFeed(query: TransactionQuery(itemId: item.id), showItem: false)
                        .navigationTitle("History")
                }
            }
            .padding(.horizontal)
            if history.isEmpty {
                Text("No stock movements yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card()
                    .padding(.horizontal)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(history.prefix(8).enumerated()), id: \.element.id) { index, transaction in
                        if index > 0 { Divider().padding(.leading, 64) }
                        TransactionRow(transaction: transaction, showItem: false)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                    }
                }
                .card(padding: 0)
                .padding(.horizontal)
            }
        }
    }

    private func shareText(_ item: Item) -> String {
        var lines = ["\(item.name) (\(item.itemNumber))", "On hand: \(item.onHand) \(item.unitLabel)"]
        for location in item.stockedLocations { lines.append("• \(location.code): \(location.quantity)") }
        return lines.joined(separator: "\n")
    }

    // MARK: Loading & actions

    private func load() async {
        let api = model.api
        guard let workspaceId = model.workspace?.id else { return }
        do {
            let fresh = try await api.item(id: itemId)
            fetched = fresh
            if store.item(id: itemId) != nil { store.apply(fresh) }
            error = nil
            async let imagesTask = try? api.images(itemId: itemId)
            async let historyTask = try? api.transactions(workspaceId: workspaceId, TransactionQuery(itemId: itemId, limit: 8))
            async let lotsTask = fresh.lotTracking ? (try? api.lots(itemId: itemId)) : nil
            let (imgs, page, lotList) = await (imagesTask, historyTask, lotsTask)
            withAnimation(.snappy) {
                images = imgs ?? images
                history = page?.transactions ?? history
                lots = (lotList ?? []).sorted {
                    ($0.quantity == 0 ? 1 : 0, $0.expirationDate ?? .distantFuture) < ($1.quantity == 0 ? 1 : 0, $1.expirationDate ?? .distantFuture)
                }
            }
        } catch is CancellationError {
        } catch let apiError as APIError where apiError.kind == .notFound {
            store.remove(itemId: itemId)
            error = apiError.localizedDescription
        } catch {
            if item == nil { self.error = error.localizedDescription }
        }
    }

    private func upload(_ image: UIImage) async {
        guard let data = image.preparedForUpload() else { return }
        uploading = true
        defer { uploading = false }
        do {
            _ = try await model.api.uploadImage(itemId: itemId, jpeg: data, isPrimary: images.isEmpty)
            await ImageCache.shared.invalidate(itemId: itemId)
            images = (try? await model.api.images(itemId: itemId)) ?? images
            thumbnailToken += 1
            store.markChanged()
            Haptics.success()
            toast = Toast(message: "Photo added", symbol: "photo.fill")
        } catch {
            Haptics.error()
            toast = Toast(message: error.localizedDescription, style: .error)
        }
    }

    private func makePrimary(_ image: ItemImage) async {
        do {
            try await model.api.setPrimaryImage(id: image.id)
            await ImageCache.shared.invalidate(itemId: itemId)
            images = (try? await model.api.images(itemId: itemId)) ?? images
            store.markChanged()
        } catch {
            toast = Toast(message: error.localizedDescription, style: .error)
        }
    }

    private func deleteImage(_ image: ItemImage) async {
        do {
            try await model.api.deleteImage(id: image.id)
            await ImageCache.shared.invalidate(itemId: itemId)
            withAnimation { images.removeAll { $0.id == image.id } }
            store.markChanged()
        } catch {
            toast = Toast(message: error.localizedDescription, style: .error)
        }
    }

    private func delete() async {
        do {
            try await model.api.deleteItem(id: itemId)
            Haptics.success()
            store.remove(itemId: itemId)
            if router.sheet == .item(id: itemId) {
                router.sheet = nil
            } else {
                dismiss()
            }
        } catch {
            Haptics.error()
            toast = Toast(message: error.localizedDescription, style: .error)
        }
    }
}

// MARK: - Pieces

private struct DetailAction: View {
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
            VStack(spacing: 6) {
                Image(systemName: symbol)
                    .font(.system(size: 18, weight: .bold))
                    .frame(width: 46, height: 46)
                    .foregroundStyle(.white)
                    .background(tint.gradient, in: .circle)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18, style: .continuous))
            .opacity(isEnabled ? 1 : 0.4)
        }
        .buttonStyle(PressableStyle())
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    var last = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(label).foregroundStyle(.secondary)
                Spacer()
                Text(value)
                    .multilineTextAlignment(.trailing)
            }
            .font(.subheadline)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            if !last { Divider().padding(.leading, 14) }
        }
    }
}

struct LotRow: View {
    let lot: Lot
    let unit: String

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(lot.lotNumber)
                        .font(.body.weight(.semibold).monospaced())
                    if lot.status != .active {
                        Pill(text: lot.status.title, color: lot.status.color)
                    }
                }
                HStack(spacing: 6) {
                    if let days = lot.daysUntilExpiry {
                        Label(Format.expiry(days: days), systemImage: "calendar")
                            .foregroundStyle(days < 0 ? .red : days <= 30 ? .orange : .secondary)
                    } else {
                        Label("No expiry", systemImage: "calendar")
                    }
                    if !lot.stockedLocations.isEmpty {
                        Text("· \(lot.stockedLocations.map(\.code).joined(separator: ", "))")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            Spacer()
            Text("\(Format.number(lot.quantity))")
                .font(.headline.monospacedDigit())
                .foregroundStyle(lot.quantity > 0 ? .primary : .secondary)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .contentShape(.rect)
    }
}

// MARK: - Camera capture for item photos

struct CameraPicker: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    let onImage: (UIImage) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.onImage(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

extension UIImage {
    /// Downscaled JPEG for upload (the server re-encodes anyway; this keeps uploads fast).
    func preparedForUpload(maxDimension: CGFloat = 2000) -> Data? {
        let largest = max(size.width, size.height)
        let scale = largest > maxDimension ? maxDimension / largest : 1
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: target))
        }
        return resized.jpegData(compressionQuality: 0.82)
    }
}
