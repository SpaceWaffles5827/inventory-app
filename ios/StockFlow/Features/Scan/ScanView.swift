import SwiftUI

/// The Scan tab: a full-screen camera with Find, Receive, Pick, Move and Count modes.
struct ScanView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(InventoryStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase

    @State private var scanner = CameraScanner()
    @State private var session = ScanSession()
    @State private var stockAction: StockAction?
    @State private var showManualEntry = false
    @State private var showLocationPicker = false
    @State private var showCountReview = false
    @State private var committing = false
    @State private var toast: Toast?
    @State private var pickedLocationId: String?

    private var isVisible: Bool { router.tab == .scan && scenePhase == .active }
    private var isBusy: Bool {
        stockAction != nil || showManualEntry || showLocationPicker || showCountReview || router.sheet != nil
    }

    var body: some View {
        ZStack {
            cameraLayer
                .ignoresSafeArea()

            if scanner.status == .running || scanner.status == .paused {
                ViewfinderOverlay(highlight: scanner.highlight, tint: session.mode.tint, active: scanner.status == .running)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }

            VStack(spacing: 12) {
                topBar
                if let banner = session.banner {
                    BannerView(banner: banner) { code in
                        router.sheet = .newItem(barcode: code)
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .id(banner.id)
                }
                Spacer(minLength: 0)
                bottomPanel
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .environment(\.colorScheme, .dark)
        .animation(.spring(duration: 0.35, bounce: 0.2), value: session.banner)
        .animation(.spring(duration: 0.35, bounce: 0.15), value: session.mode)
        .animation(.snappy, value: session.cart)
        .toast($toast)
        .task(id: isVisible) {
            if isVisible {
                consumeRouterRequests()
                await scanner.start()
            } else {
                scanner.stop()
            }
        }
        .onChange(of: router.requestedScanMode) { _, _ in consumeRouterRequests() }
        .onChange(of: router.pendingScanCode) { _, _ in consumeRouterRequests() }
        .onChange(of: isBusy) { _, busy in
            scanner.isPaused = busy
            if !busy { scanner.resetDuplicateFilter() }
        }
        .onChange(of: pickedLocationId) { _, id in
            guard let id, let location = store.location(id: id) else { return }
            process(.location(location))
            pickedLocationId = nil
        }
        .onAppear {
            scanner.onCode = { code in handle(code: code) }
        }
        .stockActionSheet($stockAction) { message in
            toast = Toast(message: message)
            if session.mode == .move {
                session.moveItem = nil
                session.banner = ScanBanner(text: "Scan the next item to move", style: .info)
            }
        }
        .sheet(isPresented: $showManualEntry) {
            ManualCodeSheet { code in handle(code: code) }
        }
        .sheet(isPresented: $showLocationPicker) {
            NavigationStack {
                LocationPickerList(
                    title: "Choose Location",
                    stocked: [],
                    others: store.locations.map { LocationOption(id: $0.id, code: $0.code, path: $0.path, quantity: $0.totalUnits) },
                    selection: $pickedLocationId
                )
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showLocationPicker = false }
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showCountReview) {
            CountReviewSheet(session: session) { message in
                toast = Toast(message: message)
            }
        }
    }

    // MARK: Camera

    @ViewBuilder private var cameraLayer: some View {
        switch scanner.status {
        case .running, .paused:
            CameraPreview(scanner: scanner)
        case .unauthorized:
            CameraPlaceholder(
                symbol: "camera.fill",
                title: "Camera Access Needed",
                message: "Allow camera access in Settings to scan barcodes. You can still type codes.",
                actionTitle: "Open Settings"
            ) {
                if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            }
        case .unavailable:
            CameraPlaceholder(
                symbol: "barcode.viewfinder",
                title: "No Camera Available",
                message: "Use “Enter code” to type or paste a barcode. Everything else works the same.",
                actionTitle: nil
            ) {}
        case .idle:
            Color.black
        }
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack(spacing: 10) {
            ModePicker(mode: $session.mode)
            Spacer(minLength: 0)
            if scanner.hasTorch {
                Button {
                    scanner.toggleTorch()
                    Haptics.tap()
                } label: {
                    Image(systemName: scanner.torchOn ? "flashlight.on.fill" : "flashlight.off.fill")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(scanner.torchOn ? .yellow : .white)
                        .frame(width: 46, height: 46)
                        .contentTransition(.symbolEffect(.replace))
                }
                .glassCircle()
                .accessibilityLabel(scanner.torchOn ? "Turn off flashlight" : "Turn on flashlight")
            }
        }
        .padding(.top, 4)
    }

    // MARK: Bottom panel

    @ViewBuilder private var bottomPanel: some View {
        VStack(spacing: 10) {
            switch session.mode {
            case .find:
                if let result = session.result {
                    ScanResultCard(
                        match: result,
                        action: $stockAction,
                        onCount: { location in
                            session.mode = .count
                            process(.location(location))
                        },
                        onDismiss: { session.result = nil }
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                } else {
                    PromptCapsule(text: session.mode.prompt)
                }
            case .receive, .pick:
                BatchPanel(
                    session: session,
                    committing: committing,
                    onChooseLocation: { showLocationPicker = true },
                    onCommit: { Task { await commitBatch() } }
                )
            case .move:
                MovePanel(
                    session: session,
                    onChooseDestination: {
                        if let item = session.moveItem {
                            stockAction = .transfer(item, fromLocationId: session.location?.id)
                        }
                    },
                    onChooseSource: { showLocationPicker = true }
                )
            case .count:
                CountPanel(
                    session: session,
                    onChooseLocation: { showLocationPicker = true },
                    onReview: { showCountReview = true }
                )
            }

            HStack(spacing: 10) {
                Button {
                    showManualEntry = true
                } label: {
                    Label("Enter code", systemImage: "keyboard")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 11)
                }
                .glassCapsule()
                .foregroundStyle(.white)
            }
        }
    }

    // MARK: Handling scans

    private func consumeRouterRequests() {
        if let mode = router.requestedScanMode {
            session.mode = mode
            router.requestedScanMode = nil
        }
        if let code = router.pendingScanCode {
            router.pendingScanCode = nil
            handle(code: code)
        }
    }

    private func handle(code: String) {
        Task {
            let match = await store.resolve(code: code)
            process(match)
        }
    }

    private func process(_ match: ScanMatch) {
        switch (session.mode, match) {
        case (.find, .unknown(let code)):
            ScanFeedback.unknown()
            session.result = match
            session.banner = nil
            _ = code
        case (.find, _):
            ScanFeedback.matched()
            session.result = match
            session.banner = nil

        case (_, .unknown(let code)):
            ScanFeedback.unknown()
            session.banner = ScanBanner(text: "Nothing matches “\(code)”", style: .warning, createCode: code)

        case (.receive, .item(let item)), (.pick, .item(let item)):
            ScanFeedback.matched()
            let direction = session.mode.direction ?? .input
            if item.lotTracking {
                session.banner = ScanBanner(text: "\(item.name) is lot tracked. Choose the lot.", style: .info)
                stockAction = .adjust(item, direction, locationId: session.location?.id)
            } else {
                let quantity = session.increment(item)
                session.banner = ScanBanner(text: "\(item.name) × \(quantity)", style: .success)
            }

        case (.receive, .location(let location)), (.pick, .location(let location)):
            ScanFeedback.matched()
            session.location = location
            let verb = session.mode == .receive ? "Receiving into" : "Picking from"
            session.banner = ScanBanner(text: "\(verb) \(location.code)", style: .success)

        case (.move, .item(let item)):
            ScanFeedback.matched()
            let fresh = store.item(id: item.id) ?? item
            if fresh.onHand <= 0 {
                session.banner = ScanBanner(text: "\(item.name) has no stock to move", style: .warning)
                return
            }
            session.moveItem = fresh
            session.banner = ScanBanner(text: "Now scan the destination location", style: .info)

        case (.move, .location(let location)):
            ScanFeedback.matched()
            if let item = session.moveItem {
                stockAction = .transfer(item, fromLocationId: session.location?.id, toLocationId: location.id)
            } else {
                session.location = location
                session.banner = ScanBanner(text: "Moving from \(location.code). Scan an item.", style: .info)
            }

        case (.count, .location(let location)):
            ScanFeedback.matched()
            startCount(at: location)

        case (.count, .item(let item)):
            guard session.location != nil else {
                ScanFeedback.unknown()
                session.banner = ScanBanner(text: "Scan a location first, then its items", style: .warning)
                return
            }
            ScanFeedback.matched()
            let quantity = session.increment(item)
            let expected = session.expected[item.id]
            session.banner = ScanBanner(
                text: expected.map { "\(item.name): \(quantity) of \($0)" } ?? "\(item.name): \(quantity) (not expected here)",
                style: expected == nil ? .warning : .success
            )
        }
    }

    private func startCount(at location: Location) {
        session.clearCart()
        session.location = location
        session.expected = [:]
        session.expectedItems = []
        session.banner = ScanBanner(text: "Counting \(location.code). Scan every item on the shelf.", style: .success)
        Task {
            guard let workspaceId = model.workspace?.id,
                  let detail = try? await model.api.location(id: location.id, workspaceId: workspaceId) else { return }
            let items = (detail.items ?? []).filter { $0.quantity > 0 }
            session.expectedItems = items
            session.expected = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0.quantity) })
        }
    }

    // MARK: Committing a batch

    private func commitBatch() async {
        guard let direction = session.mode.direction, !session.cart.isEmpty else { return }
        committing = true
        defer { committing = false }
        var units = 0
        var lines = 0
        let reason = direction == .input ? "Received (mobile scan)" : "Picked (mobile scan)"
        for line in session.cart {
            let item = store.item(id: line.item.id) ?? line.item
            guard let locationId = session.location?.id ?? defaultLocation(for: item, direction: direction) else {
                session.setError(direction == .output ? "No stock to pick" : "Choose a location", for: item.id)
                continue
            }
            do {
                let updated = try await model.api.adjustStock(itemId: item.id, AdjustStockBody(
                    type: direction, quantity: line.quantity, reason: reason, locationId: locationId
                ))
                store.apply(updated)
                session.remove(itemId: item.id)
                units += line.quantity
                lines += 1
            } catch {
                session.setError(error.localizedDescription, for: item.id)
            }
        }
        try? await store.refreshLocations()
        if lines > 0 {
            Haptics.success()
            let verb = direction == .input ? "Received" : "Picked"
            toast = Toast(message: "\(verb) \(Format.number(units)) units across \(lines) \(lines == 1 ? "item" : "items")")
            session.banner = nil
        }
        if !session.cart.isEmpty {
            Haptics.warning()
            toast = Toast(message: "Some lines need attention", style: .error)
        }
    }

    private func defaultLocation(for item: Item, direction: StockDirection) -> String? {
        switch direction {
        case .output:
            return item.stockedLocations.first?.locationId
        case .input:
            return item.stockedLocations.first?.locationId ?? item.locations?.first?.locationId ?? store.locations.first?.id
        }
    }
}

// MARK: - Overlay

private struct ViewfinderOverlay: View {
    let highlight: CameraScanner.Detection?
    let tint: Color
    let active: Bool

    @State private var sweep = false

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let width = min(size.width - 64, 340)
            let height = width * 0.62
            let rect = CGRect(x: (size.width - width) / 2, y: size.height * 0.36 - height / 2, width: width, height: height)

            ZStack {
                // Dim everything but the window.
                Path { path in
                    path.addRect(CGRect(origin: .zero, size: size))
                    path.addRoundedRect(in: rect, cornerSize: CGSize(width: 26, height: 26), style: .continuous)
                }
                .fill(Color.black.opacity(active ? 0.38 : 0.0), style: FillStyle(eoFill: true))

                CornerBrackets()
                    .stroke(highlight == nil ? Color.white : tint, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)
                    .scaleEffect(highlight == nil ? 1 : 0.97)
                    .animation(.spring(duration: 0.25, bounce: 0.4), value: highlight == nil)

                if active && highlight == nil {
                    LinearGradient(colors: [tint.opacity(0), tint.opacity(0.9), tint.opacity(0)], startPoint: .leading, endPoint: .trailing)
                        .frame(width: rect.width - 36, height: 2)
                        .shadow(color: tint, radius: 6)
                        .position(x: rect.midX, y: sweep ? rect.maxY - 18 : rect.minY + 18)
                        .onAppear {
                            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { sweep = true }
                        }
                }

                if let bounds = highlight?.bounds {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(tint, lineWidth: 3)
                        .background(tint.opacity(0.18), in: .rect(cornerRadius: 8, style: .continuous))
                        .frame(width: bounds.width + 12, height: bounds.height + 12)
                        .position(x: bounds.midX, y: bounds.midY)
                        .transition(.opacity)
                }
            }
        }
        .animation(.easeOut(duration: 0.15), value: highlight)
    }
}

private struct CornerBrackets: Shape {
    func path(in rect: CGRect) -> Path {
        let length = min(rect.width, rect.height) * 0.2
        let radius: CGFloat = 22
        var path = Path()
        // top-left
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + length))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + radius))
        path.addQuadCurve(to: CGPoint(x: rect.minX + radius, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX + length, y: rect.minY))
        // top-right
        path.move(to: CGPoint(x: rect.maxX - length, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - radius, y: rect.minY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + radius), control: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + length))
        // bottom-right
        path.move(to: CGPoint(x: rect.maxX, y: rect.maxY - length))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - radius))
        path.addQuadCurve(to: CGPoint(x: rect.maxX - radius, y: rect.maxY), control: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX - length, y: rect.maxY))
        // bottom-left
        path.move(to: CGPoint(x: rect.minX + length, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + radius, y: rect.maxY))
        path.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - radius), control: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - length))
        return path
    }
}

private struct CameraPlaceholder: View {
    let symbol: String
    let title: String
    let message: String
    let actionTitle: String?
    let action: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.06, green: 0.08, blue: 0.16), Color(red: 0.02, green: 0.02, blue: 0.05)],
                startPoint: .top,
                endPoint: .bottom
            )
            VStack(spacing: 14) {
                Image(systemName: symbol)
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(.white.opacity(0.7))
                    .symbolEffect(.pulse, options: .repeating)
                Text(title)
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
                if let actionTitle {
                    Button(actionTitle, action: action)
                        .prominentGlassButton()
                        .padding(.top, 6)
                }
            }
            .offset(y: -60)
        }
    }
}

// MARK: - Controls

private struct ModePicker: View {
    @Binding var mode: ScanMode
    @Namespace private var namespace

    var body: some View {
        HStack(spacing: 2) {
            ForEach(ScanMode.allCases) { option in
                Button {
                    guard option != mode else { return }
                    Haptics.selection()
                    mode = option
                } label: {
                    Text(option.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(option == mode ? Color.white : Color.white.opacity(0.75))
                        .padding(.horizontal, 11)
                        .padding(.vertical, 9)
                        .background {
                            if option == mode {
                                Capsule()
                                    .fill(option.tint.gradient)
                                    .matchedGeometryEffect(id: "mode", in: namespace)
                            }
                        }
                        .contentShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(option == mode ? .isSelected : [])
            }
        }
        .padding(4)
        .glassCapsule()
        .animation(.spring(duration: 0.3, bounce: 0.2), value: mode)
    }
}

private struct PromptCapsule: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .glassCapsule(interactive: false)
    }
}

private struct BannerView: View {
    let banner: ScanBanner
    let onCreate: (String) -> Void

    private var color: Color {
        switch banner.style {
        case .info: .white
        case .success: .green
        case .warning: .orange
        }
    }

    private var symbol: String {
        switch banner.style {
        case .info: "info.circle.fill"
        case .success: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(color)
            Text(banner.text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
            if let code = banner.createCode {
                Button("Create") { onCreate(code) }
                    .font(.subheadline.bold())
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .glassCapsule(interactive: false)
    }
}

// MARK: - Manual entry

struct ManualCodeSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onSubmit: (String) -> Void
    @State private var code = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Barcode, item number or location", text: $code)
                        .font(.body.monospaced())
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .focused($focused)
                        .submitLabel(.search)
                        .onSubmit(submit)
                } footer: {
                    Text("Matches item barcodes and numbers (like ITM-001) and location codes.")
                }
                if let pasted = UIPasteboard.general.hasStrings ? "Paste" : nil {
                    Section {
                        Button(pasted, systemImage: "doc.on.clipboard") {
                            code = UIPasteboard.general.string ?? code
                        }
                    }
                }
            }
            .navigationTitle("Enter Code")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Look Up", action: submit)
                        .disabled(code.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { focused = true }
        }
        .presentationDetents([.medium])
    }

    private func submit() {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        onSubmit(trimmed)
        dismiss()
    }
}

/// A camera sheet that returns the first code it sees (for filling in barcode / lot fields).
struct SingleCodeScannerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let onCode: (String) -> Void

    @State private var scanner = CameraScanner()
    @State private var manualCode = ""

    var body: some View {
        NavigationStack {
            ZStack {
                if scanner.status == .running || scanner.status == .paused {
                    CameraPreview(scanner: scanner)
                        .ignoresSafeArea()
                    ViewfinderOverlay(highlight: scanner.highlight, tint: .accentColor, active: true)
                        .ignoresSafeArea()
                        .allowsHitTesting(false)
                } else {
                    Form {
                        Section {
                            TextField("Type the code", text: $manualCode)
                                .font(.body.monospaced())
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.characters)
                                .onSubmit(useManual)
                        } header: {
                            Text(scanner.status == .unauthorized ? "Camera access is off" : "No camera available")
                        }
                        Button("Use Code", action: useManual)
                            .disabled(manualCode.isEmpty)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task {
                scanner.onCode = { code in
                    ScanFeedback.matched()
                    onCode(code)
                    dismiss()
                }
                await scanner.start()
            }
            .onDisappear { scanner.stop() }
        }
    }

    private func useManual() {
        guard !manualCode.isEmpty else { return }
        onCode(manualCode)
        dismiss()
    }
}
