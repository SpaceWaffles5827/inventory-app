import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @AppStorage(Preferences.appearanceKey) private var appearance = AppearanceMode.system.rawValue
    @AppStorage(Preferences.scanHapticsKey) private var scanHaptics = true
    @AppStorage(Preferences.scanSoundKey) private var scanSound = true

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
                    LabeledContent("Server") {
                        Text(serverLabel)
                            .font(.callout.monospaced())
                            .foregroundStyle(.secondary)
                    }
                    Link(destination: webURL) {
                        Label("Open StockFlow on the web", systemImage: "safari")
                    }
                } header: {
                    Text("Connection")
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
