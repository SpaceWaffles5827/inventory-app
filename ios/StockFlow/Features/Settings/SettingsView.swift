import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @AppStorage(Preferences.appearanceKey) private var appearance = AppearanceMode.system.rawValue
    @AppStorage(Preferences.scanHapticsKey) private var scanHaptics = true
    @AppStorage(Preferences.scanSoundKey) private var scanSound = true
    @AppStorage(Preferences.developerModeKey) private var developerMode = false
    @State private var versionTaps = 0
    @State private var customServer = ""
    @State private var switching = false

    @State private var editingName = false
    @State private var name = ""
    @State private var confirmSignOut = false
    @State private var error: String?

    private var version: String {
        let short = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(short) (\(build))"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        AvatarView(initials: model.user?.initials ?? "?", size: 56)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(model.user?.displayName ?? "")
                                .font(.headline)
                            Text(model.user?.email ?? "")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Edit") {
                            name = model.user?.name ?? ""
                            editingName = true
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    ForEach(model.workspaces) { workspace in
                        Button {
                            model.select(workspace)
                            Haptics.selection()
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(workspace.name)
                                        .foregroundStyle(.primary)
                                    HStack(spacing: 6) {
                                        Text(workspace.role.title)
                                        if let items = workspace.counts?.items {
                                            Text("· \(items) items")
                                        }
                                        if let plan = workspace.subscription?.plan {
                                            Text("· \(plan.capitalized)")
                                        }
                                    }
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if workspace.id == model.workspace?.id {
                                    Image(systemName: "checkmark")
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.tint)
                                }
                            }
                            .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("Workspace")
                } footer: {
                    Text("Invite teammates, manage billing and customers from the StockFlow web app.")
                }

                Section("Appearance") {
                    Picker("Theme", selection: $appearance) {
                        ForEach(AppearanceMode.allCases) { mode in
                            Text(mode.title).tag(mode.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Scanner") {
                    Toggle("Vibrate on scan", isOn: $scanHaptics)
                    Toggle("Sound on scan", isOn: $scanSound)
                }

                Section {
                    Link(destination: webURL) {
                        Label("Open StockFlow on the web", systemImage: "safari")
                    }
                }

                if developerMode {
                    developerSection
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }

                Section {
                    Button("Sign Out", role: .destructive) { confirmSignOut = true }
                        .frame(maxWidth: .infinity)
                } footer: {
                    Text("StockFlow for iOS \(version)")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                        .contentShape(.rect)
                        .onTapGesture {
                            // Secret: tap the version 5 times to toggle developer settings.
                            versionTaps += 1
                            if versionTaps >= 5 {
                                versionTaps = 0
                                withAnimation { developerMode.toggle() }
                                Haptics.success()
                            }
                        }
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Your Name", isPresented: $editingName) {
                TextField("Name", text: $name)
                    .textContentType(.name)
                Button("Cancel", role: .cancel) {}
                Button("Save") {
                    Task {
                        do { try await model.updateName(name.trimmingCharacters(in: .whitespaces)) }
                        catch { self.error = error.localizedDescription }
                    }
                }
            }
            .confirmationDialog("Sign out of StockFlow?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) {
                    dismiss()
                    Task { await model.signOut() }
                }
            }
        }
    }

    @ViewBuilder private var developerSection: some View {
        Section {
            LabeledContent("Connected to") {
                Text(serverLabel)
                    .font(.callout.monospaced())
                    .foregroundStyle(.secondary)
            }
            ForEach(Preferences.recentServers.filter { $0 != model.serverURL.absoluteString }, id: \.self) { server in
                Button {
                    connect(to: server)
                } label: {
                    Label(server, systemImage: "arrow.triangle.swap")
                        .font(.callout.monospaced())
                }
            }
            HStack {
                TextField("Other server address", text: $customServer)
                    .font(.callout.monospaced())
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit { connect(to: customServer) }
                if switching {
                    ProgressView()
                } else {
                    Button("Connect") { connect(to: customServer) }
                        .buttonStyle(.borderless)
                        .disabled(Preferences.normalizedServerURL(customServer) == nil)
                }
            }
            Button("Hide Developer Settings", role: .destructive) {
                withAnimation { developerMode = false }
            }
        } header: {
            Text("Developer · Server")
        } footer: {
            Text("Switch between servers (e.g. dev and production). Each server remembers its own sign-in.")
        }
    }

    private func connect(to raw: String) {
        guard let url = Preferences.normalizedServerURL(raw) else {
            error = "That server address isn't valid."
            return
        }
        switching = true
        Haptics.tap()
        dismiss()
        Task {
            await model.switchServer(to: url)
            switching = false
        }
    }

    private var serverLabel: String {
        guard let host = model.serverURL.host() else { return model.serverURL.absoluteString }
        return model.serverURL.port.map { "\(host):\($0)" } ?? host
    }

    /// The web app usually lives next to the API (same host, front-end port); fall back to the API URL.
    private var webURL: URL {
        var components = URLComponents(url: model.serverURL, resolvingAgainstBaseURL: false)
        if components?.port == 5001 { components?.port = 3000 }
        if components?.port == 5100 { components?.port = 3100 }
        return components?.url ?? model.serverURL
    }
}
