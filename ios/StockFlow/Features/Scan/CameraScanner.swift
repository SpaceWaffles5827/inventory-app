@preconcurrency import AVFoundation
import AudioToolbox
import SwiftUI
import UIKit

/// Live barcode / QR detection with AVFoundation.
@MainActor
@Observable
final class CameraScanner: NSObject {
    enum Status: Equatable {
        case idle
        case running
        case paused
        case unauthorized
        case unavailable
    }

    struct Detection: Equatable {
        let code: String
        /// Bounds in preview-layer coordinates, for the highlight box.
        let bounds: CGRect?
    }

    private(set) var status: Status = .idle
    private(set) var torchOn = false
    private(set) var hasTorch = false
    /// Most recent detection, used to draw the highlight.
    private(set) var highlight: Detection?

    /// Called once per new code (after de-duplication).
    var onCode: ((String) -> Void)?
    /// Same code is ignored for this long after it was last reported.
    var repeatInterval: TimeInterval = 1.5

    @ObservationIgnored let session = AVCaptureSession()
    @ObservationIgnored weak var previewLayer: AVCaptureVideoPreviewLayer?
    @ObservationIgnored private let sessionQueue = DispatchQueue(label: "com.stockflow.scanner.session")
    @ObservationIgnored private var device: AVCaptureDevice?
    @ObservationIgnored private var configured = false
    @ObservationIgnored private var lastCode: String?
    @ObservationIgnored private var lastCodeAt = Date.distantPast
    @ObservationIgnored private var highlightTask: Task<Void, Never>?

    static let symbologies: [AVMetadataObject.ObjectType] = [
        .ean13, .ean8, .upce, .code128, .code39, .code39Mod43, .code93, .itf14, .interleaved2of5,
        .qr, .dataMatrix, .pdf417, .aztec, .codabar, .gs1DataBar, .gs1DataBarExpanded, .gs1DataBarLimited,
    ]

    // MARK: Lifecycle

    func start() async {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            break
        case .notDetermined:
            guard await AVCaptureDevice.requestAccess(for: .video) else {
                status = .unauthorized
                return
            }
        default:
            status = .unauthorized
            return
        }

        if !configured {
            guard configure() else {
                status = .unavailable
                return
            }
        }
        let session = session
        await withCheckedContinuation { continuation in
            sessionQueue.async {
                if !session.isRunning { session.startRunning() }
                continuation.resume()
            }
        }
        status = .running
    }

    func stop() {
        guard configured else { return }
        setTorch(false)
        let session = session
        sessionQueue.async {
            if session.isRunning { session.stopRunning() }
        }
        if status == .running { status = .paused }
    }

    /// Temporarily ignore detections (e.g. while a sheet is open) without stopping the camera.
    var isPaused = false

    private func configure() -> Bool {
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera, .builtInWideAngleCamera],
            mediaType: .video,
            position: .back
        )
        guard let device = discovery.devices.first,
              let input = try? AVCaptureDeviceInput(device: device) else { return false }

        session.beginConfiguration()
        session.sessionPreset = .high
        guard session.canAddInput(input) else {
            session.commitConfiguration()
            return false
        }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else {
            session.commitConfiguration()
            return false
        }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = Self.symbologies.filter(output.availableMetadataObjectTypes.contains)
        session.commitConfiguration()

        // Multi-camera devices: start at the wide lens ("1x") so the system can
        // switch to the ultra-wide for close-up (macro) barcodes automatically.
        if (try? device.lockForConfiguration()) != nil {
            if let wide = device.virtualDeviceSwitchOverVideoZoomFactors.first {
                device.videoZoomFactor = CGFloat(truncating: wide)
            }
            if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            if device.isAutoFocusRangeRestrictionSupported { device.autoFocusRangeRestriction = .near }
            device.unlockForConfiguration()
        }

        self.device = device
        hasTorch = device.hasTorch
        configured = true
        return true
    }

    // MARK: Torch

    func toggleTorch() { setTorch(!torchOn) }

    func setTorch(_ on: Bool) {
        guard let device, device.hasTorch, (try? device.lockForConfiguration()) != nil else { return }
        device.torchMode = on ? .on : .off
        device.unlockForConfiguration()
        torchOn = on
    }

    // MARK: Detection

    fileprivate func handle(_ objects: [AVMetadataObject]) {
        guard !isPaused else { return }
        guard let object = objects.compactMap({ $0 as? AVMetadataMachineReadableCodeObject }).first,
              let code = object.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !code.isEmpty else { return }

        let bounds = previewLayer?.transformedMetadataObject(for: object)?.bounds
        showHighlight(Detection(code: code, bounds: bounds))

        let now = Date()
        if code == lastCode, now.timeIntervalSince(lastCodeAt) < repeatInterval {
            lastCodeAt = now
            return
        }
        lastCode = code
        lastCodeAt = now
        onCode?(code)
    }

    /// Allow the same code to be reported again right away (after the user acts on it).
    func resetDuplicateFilter() {
        lastCode = nil
    }

    private func showHighlight(_ detection: Detection) {
        highlight = detection
        highlightTask?.cancel()
        highlightTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(450))
            guard !Task.isCancelled else { return }
            self?.highlight = nil
        }
    }
}

extension CameraScanner: AVCaptureMetadataOutputObjectsDelegate {
    nonisolated func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        MainActor.assumeIsolated { handle(metadataObjects) }
    }
}

/// The camera feed as a SwiftUI view.
struct CameraPreview: UIViewRepresentable {
    let scanner: CameraScanner

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = scanner.session
        view.previewLayer.videoGravity = .resizeAspectFill
        scanner.previewLayer = view.previewLayer
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
}

/// Scan feedback: haptic + optional sound, respecting the user's settings.
@MainActor
enum ScanFeedback {
    static func matched() {
        if UserDefaults.standard.object(forKey: Preferences.scanHapticsKey) as? Bool ?? true {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
        if UserDefaults.standard.object(forKey: Preferences.scanSoundKey) as? Bool ?? true {
            AudioServicesPlaySystemSound(1057)
        }
    }

    static func unknown() {
        if UserDefaults.standard.object(forKey: Preferences.scanHapticsKey) as? Bool ?? true {
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        }
        if UserDefaults.standard.object(forKey: Preferences.scanSoundKey) as? Bool ?? true {
            AudioServicesPlaySystemSound(1053)
        }
    }
}
