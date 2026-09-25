import SwiftUI

struct SignUpView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State var server: String
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var working = false
    @State private var error: String?

    private var passwordOK: Bool { password.count >= 8 && password.utf8.count <= 72 }
    private var canSubmit: Bool {
        Preferences.normalizedServerURL(server) != nil
            && !firstName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lastName.trimmingCharacters(in: .whitespaces).isEmpty
            && email.contains("@") && passwordOK && !working
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("First name", text: $firstName)
                        .textContentType(.givenName)
                    TextField("Last name", text: $lastName)
                        .textContentType(.familyName)
                } header: {
                    Text("Your name")
                }

                Section {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(.newPassword)
                } header: {
                    Text("Account")
                } footer: {
                    Label(
                        "At least 8 characters",
                        systemImage: passwordOK ? "checkmark.circle.fill" : "circle"
                    )
                    .foregroundStyle(passwordOK ? .green : .secondary)
                }

                Section("Server") {
                    ServerField(text: $server)
                        .listRowInsets(EdgeInsets())
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(action: submit) {
                        HStack {
                            Spacer()
                            if working { ProgressView() } else { Text("Create Account").bold() }
                            Spacer()
                        }
                    }
                    .disabled(!canSubmit)
                } footer: {
                    Text("A personal workspace is created for you. You can invite teammates from the web app.")
                }
            }
            .navigationTitle("Create Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() {
        guard let url = Preferences.normalizedServerURL(server) else { return }
        working = true
        error = nil
        Task {
            do {
                try await model.signUp(server: url, body: RegisterBody(
                    firstName: firstName.trimmingCharacters(in: .whitespaces),
                    lastName: lastName.trimmingCharacters(in: .whitespaces),
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password
                ))
                Haptics.success()
                dismiss()
            } catch {
                self.error = error.localizedDescription
                Haptics.error()
            }
            working = false
        }
    }
}

struct ForgotPasswordView: View {
    @Environment(\.dismiss) private var dismiss
    let server: String
    @State var email: String
    @State private var working = false
    @State private var sent = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                if sent {
                    Section {
                        VStack(spacing: 12) {
                            Image(systemName: "envelope.badge.fill")
                                .font(.system(size: 44))
                                .foregroundStyle(.tint)
                                .symbolEffect(.bounce, value: sent)
                            Text("Check your email")
                                .font(.headline)
                            Text("If an account exists for \(email), we've sent a link to reset your password.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical)
                    }
                } else {
                    Section {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    } footer: {
                        Text("We'll email you a link to choose a new password.")
                    }
                    if let error {
                        Section { Text(error).foregroundStyle(.red) }
                    }
                    Section {
                        Button {
                            guard let url = Preferences.normalizedServerURL(server) else {
                                error = "Enter your server address first."
                                return
                            }
                            working = true
                            Task {
                                do {
                                    try await APIClient(baseURL: url).requestPasswordReset(email: email)
                                    withAnimation { sent = true }
                                } catch {
                                    self.error = error.localizedDescription
                                }
                                working = false
                            }
                        } label: {
                            HStack {
                                Spacer()
                                if working { ProgressView() } else { Text("Send Reset Link").bold() }
                                Spacer()
                            }
                        }
                        .disabled(!email.contains("@") || working)
                    }
                }
            }
            .navigationTitle("Reset Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(sent ? "Done" : "Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
