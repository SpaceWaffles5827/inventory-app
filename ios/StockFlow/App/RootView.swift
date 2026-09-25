import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            switch model.phase {
            case .launching:
                LaunchView()
                    .transition(.opacity)
            case .unreachable(let message):
                UnreachableView(message: message)
                    .transition(.opacity)
            case .signedOut:
                SignInView()
                    .transition(.asymmetric(insertion: .opacity, removal: .opacity.combined(with: .scale(scale: 1.04))))
            case .signedIn:
                if let store = model.store {
                    MainTabView()
                        .environment(store)
                        .id(store.workspaceId)
                        .transition(.opacity)
                } else {
                    NoWorkspaceView()
                        .transition(.opacity)
                }
            }
        }
        .animation(.smooth(duration: 0.35), value: model.phase)
        .animation(.smooth(duration: 0.35), value: model.store?.workspaceId)
        .task { await model.bootstrap() }
    }
}

/// Matches the launch screen (LaunchBackground + LaunchMark) so launch feels seamless.
struct LaunchView: View {
    var body: some View {
        ZStack {
            Color("LaunchBackground").ignoresSafeArea()
            VStack(spacing: 24) {
                Image("LaunchMark")
                    .resizable()
                    .frame(width: 120, height: 120)
                    .shadow(color: .accentColor.opacity(0.3), radius: 20, y: 10)
                ProgressView()
                    .controlSize(.regular)
            }
        }
    }
}

private struct UnreachableView: View {
    @Environment(AppModel.self) private var model
    let message: String
    @State private var retrying = false

    var body: some View {
        ContentUnavailableView {
            Label("Can't Reach Server", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
            Text(model.serverURL.absoluteString)
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
        } actions: {
            Button {
                retrying = true
                Task {
                    await model.retryLaunch()
                    retrying = false
                }
            } label: {
                if retrying { ProgressView() } else { Text("Try Again").frame(minWidth: 140) }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Button("Sign Out", role: .destructive) {
                Task { await model.signOut() }
            }
        }
    }
}

private struct NoWorkspaceView: View {
    @Environment(AppModel.self) private var model
    @State private var name = ""
    @State private var working = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "building.2.crop.circle")
                            .font(.system(size: 56))
                            .foregroundStyle(.tint)
                        Text("You're not in a workspace yet")
                            .font(.title3.bold())
                        Text("Create one to start tracking inventory, or ask a teammate to invite \(model.user?.email ?? "you").")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
                .listRowBackground(Color.clear)

                Section("New workspace") {
                    TextField("Workspace name", text: $name)
                        .textInputAutocapitalization(.words)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
                Section {
                    Button {
                        working = true
                        Task {
                            do { try await model.createWorkspace(named: name.trimmingCharacters(in: .whitespaces)) }
                            catch { self.error = error.localizedDescription }
                            working = false
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if working { ProgressView() } else { Text("Create Workspace").bold() }
                            Spacer()
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || working)
                }
            }
            .navigationTitle("Welcome")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Refresh", systemImage: "arrow.clockwise") {
                            Task { try? await model.reloadWorkspaces() }
                        }
                        Button("Sign Out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                            Task { await model.signOut() }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }
}
