import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins

/// Renders item/location codes as Code 128 barcodes or QR codes, like the web label generator.
enum CodeRenderer {
    enum Kind { case barcode, qr }

    private static let context = CIContext()

    static func image(for value: String, kind: Kind, scale: CGFloat = 10) -> UIImage? {
        guard !value.isEmpty else { return nil }
        let output: CIImage?
        switch kind {
        case .barcode:
            let filter = CIFilter.code128BarcodeGenerator()
            filter.message = Data(value.utf8)
            filter.quietSpace = 4
            output = filter.outputImage
        case .qr:
            let filter = CIFilter.qrCodeGenerator()
            filter.message = Data(value.utf8)
            filter.correctionLevel = "M"
            output = filter.outputImage
        }
        guard let output else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: kind == .barcode ? scale * 3 : scale))
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

struct CodeImage: View {
    let value: String
    var kind: CodeRenderer.Kind = .barcode

    var body: some View {
        if let image = CodeRenderer.image(for: value, kind: kind) {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .accessibilityLabel("Code \(value)")
        } else {
            Image(systemName: "barcode")
                .foregroundStyle(.tertiary)
        }
    }
}

/// A full-screen, high-brightness label so another device (or a handheld scanner) can read the code.
struct CodeLabelSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let subtitle: String?
    let value: String
    @State private var kind: CodeRenderer.Kind = .qr
    @State private var previousBrightness: CGFloat?

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Picker("Code type", selection: $kind) {
                    Text("QR code").tag(CodeRenderer.Kind.qr)
                    Text("Barcode").tag(CodeRenderer.Kind.barcode)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                Spacer(minLength: 0)

                VStack(spacing: 18) {
                    CodeImage(value: value, kind: kind)
                        .frame(maxWidth: kind == .qr ? 240 : 320, maxHeight: kind == .qr ? 240 : 140)
                        .padding(24)
                        .background(.white, in: .rect(cornerRadius: 24, style: .continuous))
                        .shadow(color: .black.opacity(0.08), radius: 20, y: 8)
                        .animation(.snappy, value: kind)
                    VStack(spacing: 4) {
                        Text(title)
                            .font(.title3.bold())
                            .multilineTextAlignment(.center)
                        if let subtitle {
                            Text(subtitle).foregroundStyle(.secondary)
                        }
                        Text(value)
                            .font(.body.monospaced())
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                }
                .padding(.horizontal)

                Spacer(minLength: 0)

                ShareLink(item: value) {
                    Label("Share Code", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .glassButton()
                .controlSize(.large)
                .padding(.horizontal)
            }
            .padding(.vertical)
            .navigationTitle("Label")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }
}
