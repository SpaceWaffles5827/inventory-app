"use client"

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { BarcodeFormat, BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser"
import { DecodeHintType } from "@zxing/library"
import { playScanFeedback } from "./feedback"

export type ScannerStatus = "idle" | "starting" | "scanning" | "error"
export type ScannerErrorKind = "insecure" | "unsupported" | "permission" | "not-found" | "in-use" | "unknown"

export interface ScannerError {
  kind: ScannerErrorKind
  message: string
}

const CAMERA_KEY = "stockflow.scanner.camera"

/** Formats seen on warehouse labels and retail packaging, most common first */
const FORMATS: BarcodeFormat[] = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.EAN_13,
  BarcodeFormat.UPC_A,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
]

function createReader() {
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS)
  hints.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 300 })
}

function readStoredCamera(): string | null {
  try {
    return localStorage.getItem(CAMERA_KEY)
  } catch {
    return null
  }
}

function storeCamera(id: string | null) {
  try {
    if (id) localStorage.setItem(CAMERA_KEY, id)
    else localStorage.removeItem(CAMERA_KEY)
  } catch {
    // storage unavailable — the choice just won't be remembered
  }
}

/** Problems we can detect before asking for the camera */
function detectEnvironmentProblem(): ScannerError | null {
  if (typeof window === "undefined") return null
  if (!window.isSecureContext) {
    return {
      kind: "insecure",
      message:
        "The camera only works when StockFlow is opened over HTTPS (or on localhost). Type the code or use a handheld scanner instead.",
    }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      kind: "unsupported",
      message: "This browser can't use the camera. Type the code or use a handheld scanner instead.",
    }
  }
  return null
}

function errorName(err: unknown): string {
  return typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : ""
}

function toScannerError(err: unknown): ScannerError {
  switch (errorName(err)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        kind: "permission",
        message:
          "Camera access is blocked. Allow the camera for this site in your browser's settings and try again — or type the code instead.",
      }
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return { kind: "not-found", message: "No camera was found on this device. Type the code or use a handheld scanner instead." }
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return { kind: "in-use", message: "The camera is in use by another app or tab. Close it and try again." }
    default:
      return { kind: "unknown", message: "Couldn't start the camera. Try again, or type the code instead." }
  }
}

/** controls.stop() is sync, or async when torch support wrapped it — swallow both kinds of failure */
function stopControls(controls: IScannerControls) {
  try {
    const result = controls.stop() as unknown
    if (result instanceof Promise) result.catch(() => {})
  } catch {
    // already stopped
  }
}

interface RunState {
  key: string
  status: "scanning" | "error"
  error: ScannerError | null
  torchSupported: boolean
  activeDeviceId: string | null
}

export interface UseCameraScannerOptions {
  /** Camera on/off. Turn it off whenever the scanner isn't visible. */
  enabled: boolean
  onDetected: (code: string) => void
  /** Keep the camera running but ignore reads */
  paused?: boolean
  /** Ignore the same code again within this many ms */
  dedupeMs?: number
  /** Beep + vibrate on every accepted read (default true) */
  feedback?: boolean
}

/**
 * One camera barcode scanner for the whole app (@zxing/browser).
 * Starts/stops with `enabled`, always releases the camera on stop/unmount, remembers the chosen
 * camera, prefers the back camera, exposes torch control where supported and de-duplicates reads.
 */
export function useCameraScanner({
  enabled,
  onDetected,
  paused = false,
  dedupeMs = 1500,
  feedback = true,
}: UseCameraScannerOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastReadRef = useRef<{ code: string; at: number } | null>(null)
  // Each start waits for the previous session to release the camera (StrictMode, camera switches).
  const queueRef = useRef<Promise<void>>(Promise.resolve())

  const [environmentError] = useState(detectEnvironmentProblem)
  const [deviceId, setDeviceId] = useState<string | null>(readStoredCamera)
  const [attempt, setAttempt] = useState(0)
  const [run, setRun] = useState<RunState | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [torchOn, setTorchOn] = useState(false)

  const runKey = `${attempt}:${deviceId ?? "auto"}`

  const handleRead = useEffectEvent((text: string) => {
    if (paused) return
    const code = text.trim()
    if (!code || code.length > 512) return
    const now = Date.now()
    const last = lastReadRef.current
    if (last && last.code === code && now - last.at < dedupeMs) return
    lastReadRef.current = { code, at: now }
    if (feedback) playScanFeedback("success")
    onDetected(code)
  })

  useEffect(() => {
    if (!enabled || environmentError) return
    const video = videoRef.current
    if (!video) return

    const key = `${attempt}:${deviceId ?? "auto"}`
    let cancelled = false
    let controls: IScannerControls | null = null
    let release: () => void = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    const previous = queueRef.current
    queueRef.current = released

    const size = { width: { ideal: 1280 }, height: { ideal: 720 } }
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: "environment" }, ...size },
    }

    const start = async () => {
      await previous
      if (cancelled) return release()
      try {
        const reader = createReader()
        const started = await reader.decodeFromConstraints(constraints, video, (result) => {
          if (!result || cancelled) return
          try {
            handleRead(result.getText())
          } catch {
            // a throwing handler would end zxing's scan loop — never let it
          }
        })
        if (cancelled) {
          stopControls(started)
          return release()
        }
        controls = started
        controlsRef.current = started

        const stream = video.srcObject instanceof MediaStream ? video.srcObject : null
        const activeDeviceId = stream?.getVideoTracks()[0]?.getSettings().deviceId ?? null
        let list: MediaDeviceInfo[] = []
        try {
          list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput")
        } catch {
          // enumerateDevices unsupported — no camera picker
        }
        if (cancelled) return
        setCameras(list)
        setTorchOn(false)
        setRun({
          key,
          status: "scanning",
          error: null,
          torchSupported: typeof started.switchTorch === "function",
          activeDeviceId,
        })
      } catch (err) {
        release()
        if (cancelled) return
        const name = errorName(err)
        if (deviceId && (name === "OverconstrainedError" || name === "NotFoundError")) {
          // The remembered camera is gone (unplugged / another device) — fall back to the default one.
          storeCamera(null)
          setDeviceId(null)
          return
        }
        setRun({ key, status: "error", error: toScannerError(err), torchSupported: false, activeDeviceId: null })
      }
    }

    void start()

    return () => {
      cancelled = true
      if (controls) {
        stopControls(controls)
        if (controlsRef.current === controls) controlsRef.current = null
        controls = null
        release()
      }
    }
  }, [enabled, environmentError, deviceId, attempt])

  const current = run?.key === runKey ? run : null
  const status: ScannerStatus = !enabled
    ? "idle"
    : environmentError
      ? "error"
      : current
        ? current.status
        : "starting"

  const retry = useCallback(() => setAttempt((a) => a + 1), [])

  const selectCamera = useCallback((id: string) => {
    storeCamera(id)
    setDeviceId(id)
  }, [])

  const toggleTorch = useCallback(async () => {
    const controls = controlsRef.current
    if (!controls?.switchTorch) return
    const next = !torchOn
    try {
      await controls.switchTorch(next)
      setTorchOn(next)
    } catch {
      // torch refused by the device
    }
  }, [torchOn])

  /** Forget the last read so the same code can be accepted again immediately */
  const resetDedupe = useCallback(() => {
    lastReadRef.current = null
  }, [])

  return {
    videoRef,
    status,
    error: environmentError ?? current?.error ?? null,
    cameras,
    activeCameraId: current?.activeDeviceId ?? deviceId,
    selectCamera,
    torchSupported: status === "scanning" && !!current?.torchSupported,
    torchOn,
    toggleTorch,
    retry,
    resetDedupe,
  }
}
