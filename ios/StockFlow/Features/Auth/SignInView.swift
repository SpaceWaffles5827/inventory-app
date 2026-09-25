import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var model

    private enum Field: Hashable { case server, email, password }

    @State private var server = Preferences.initialServerURL
    @AppStorage(Preferences.developerModeKey) private var developerMode = false
    /// The server field is hidden once a server is set up; long-press the logo to show it.
    @State private var showServer = !Preferences.hasConfiguredServer
    @State private var email = UserDefaults.standard.string(forKey: Preferences.lastEmailKey) ?? ""
    @State private var password = ""
    @State private var working = false
    @State private var error: String?
    @State private var showSignUp = false
    @State private var showForgotPassword = false
    @FocusState private var focus: Field?

    private var serverURL: URL? { Preferences.normalizedServerURL(server) }
    private var canSubmit: Bool {
        serverURL != nil && email.contains("@") && !password.isEmpty && !working
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    header
                        .padding(.top, 36)

                    VStack(spacing: 14) {
                        if showServer || developerMode {
                            ServerField(text: $server)
                                .focused($focus, equals: .server)
                                .submitLabel(.next)
                                .onSubmit { focus = .email }
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        VStack(spacing: 0) {
                            AuthField(symbol: "envelope", placeholder: "Email") {
                                TextField("Email", text: $email)
                                    .textContentType(.username)
                                    .keyboardType(.emailAddress)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .focused($focus, equals: .email)
                                    .submitLabel(.next)
                                    .onSubmit { focus = .password }
                            }
                            Divider().padding(.leading, 52)
                            AuthField(symbol: "lock", placeholder: "Password") {
                                SecureField("Password", text: $password)
                                    .textContentType(.password)
                                    .focused($focus, equals: .password)
                                    .submitLabel(.go)
                                    .onSubmit(signIn)
                            }
                        }
                        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18, style: .continuous))

                        if let message = error ?? model.signedOutReason {
                            Label(message, systemImage: "exclamationmark.circle.fill")
                                .font(.subheadline)
                                .foregroundStyle(.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 4)
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }
                    }

                    VStack(spacing: 14) {
                        Button(action: signIn) {
                            ZStack {
                                Text("Sign In").opacity(working ? 0 : 1)
                                if working { ProgressView().tint(.white) }
                            }
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                        }
                        .prominentGlassButton()
                        .controlSize(.large)
                        .disabled(!canSubmit)

                        Button("Forgot password?") { showForgotPassword = true }
                            .font(.subheadline)
                    }

                    Spacer(minLength: 20)

                    HStack(spacing: 4) {
                        Text("New to StockFlow?")
                            .foregroundStyle(.secondary)
                        Button("Create an account") { showSignUp = true }
                            .fontWeight(.semibold)
                    }
                    .font(.subheadline)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
                .animation(.snappy, value: error)
                .animation(.snappy, value: showServer || developerMode)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(background)
            .sheet(isPresented: $showSignUp) {
                SignUpView(server: server)
            }
            .sheet(isPresented: $showForgotPassword) {
                ForgotPasswordView(server: server, email: email)
            }
        }
    }

    private var header: some View {
        VStack(spacing: 16) {
            Image("LaunchMark")
                .resizable()
                .frame(width: 88, height: 88)
                .shadow(color: .accentColor.opacity(0.35), radius: 18, y: 10)
                .onLongPressGesture(minimumDuration: 1.2) {
                    // Secret: reveal the server field (developer mode).
                    developerMode.toggle()
                    showServer = developerMode || !Preferences.hasConfiguredServer
                    Haptics.success()
                }
                .accessibilityHidden(true)
            VStack(spacing: 6) {
                Text("StockFlow")
                    .font(.largeTitle.bold())
                    .fontDesign(.rounded)
                Text("Scan, count and move inventory from anywhere in the warehouse.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var background: some View {
        ZStack {
            Color(.systemGroupedBackground)
            LinearGradient(
                colors: [Color.accentColor.opacity(0.22), Color.accentColor.opacity(0.0)],
                startPoint: .top,
                endPoint: .center
            )
        }
        .ignoresSafeArea()
    }

    private func signIn() {
        guard canSubmit, let url = serverURL else { return }
        focus = nil
        working = true
        error = nil
        Task {
            do {
                try await model.signIn(server: url, email: email.trimmingCharacters(in: .whitespaces), password: password)
                Haptics.success()
            } catch {
                self.error = error.localizedDescription
                Haptics.error()
            }
            working = false
        }
    }
}

// MARK: - Shared auth fields

struct AuthField<Content: View>: View {
    let symbol: String
    let placeholder: String
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.body.weight(.medium))
                .foregroundStyle(.secondary)
                .frame(width: 24)
            content
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 54)
    }
}

/// Server address with a live reachability indicator.
struct ServerField: View {
    @Binding var text: String

    private enum Reachability { case unknown, checking, ok, failed }
    @State private var reachability: Reachability = .unknown

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "server.rack")
                .font(.body.weight(.medium))
                .foregroundStyle(.secondary)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text("Server")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("inventory.example.com", text: $text)
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.callout.monospaced())
            }
            Spacer(minLength: 0)
            indicator
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18, style: .continuous))
        .task(id: text) {
            guard let url = Preferences.normalizedServerURL(text) else {
                reachability = .unknown
                return
            }
            reachability = .checking
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            let ok = await APIClient(baseURL: url).alive()
            guard !Task.isCancelled else { return }
            withAnimation(.snappy) { reachability = ok ? .ok : .failed }
        }
    }

    @ViewBuilder private var indicator: some View {
        switch reachability {
        case .unknown:
            EmptyView()
        case .checking:
            ProgressView().controlSize(.small)
        case .ok:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .transition(.scale.combined(with: .opacity))
                .accessibilityLabel("Server reachable")
        case .failed:
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .transition(.scale.combined(with: .opacity))
                .accessibilityLabel("Server not reachable")
        }
    }
}
