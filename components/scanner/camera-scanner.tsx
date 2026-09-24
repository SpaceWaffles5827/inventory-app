"use client"

import { useEffect, useState } from "react"
import { Camera, CameraOff, Check, Flashlight, FlashlightOff, Loader2, RotateCw, Volume2, VolumeX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { isScanSoundEnabled, primeScanAudio, setScanSoundEnabled } from "./feedback"
import { useCameraScanner, type ScannerErrorKind } from "./use-camera-scanner"

const SCANLINE_CSS = `@keyframes sf-scanline{0%,100%{top:6%}50%{top:calc(94% - 2px)}}`

const ERROR_TITLES: Record<ScannerErrorKind, string> = {
  insecure: "Camera needs a secure connection",
  unsupported: "Camera not supported",
  permission: "Camera access blocked",
  "not-found": "No camera found",
  "in-use": "Camera is busy",
  unknown: "Camera didn't start",
}

export type ScanFlash = "success" | "error" | null

interface CameraScannerProps {
  /** Camera on/off — turn off whenever the scanner isn't on screen */
  active: boolean
  onDetected: (code: string) => void
  /** Keep the camera running but ignore reads */
  paused?: boolean
  /** Brief overlay after a read */
  flash?: ScanFlash
  /** Instruction shown over the video */
  hint?: string
  /** Sizing for the video box; defaults to 4:3 capped at 45% of the viewport height */
  className?: string
  dedupeMs?: number
}

/** Live camera preview with scan frame, torch, camera picker and friendly error states */
export function CameraScanner({
  active,
  onDetected,
  paused,
  flash = null,
  hint = "Point the camera at a barcode",
  className,
  dedupeMs,
}: CameraScannerProps) {
  const {
    videoRef,
    status,
    error,
    cameras,
    activeCameraId,
    selectCamera,
    torchSupported,
    torchOn,
    toggleTorch,
    retry,
  } = useCameraScanner({ enabled: active, onDetected, paused, dedupeMs })
  const [sound, setSound] = useState(isScanSoundEnabled)

  // Unlock audio while we still have the gesture that opened the scanner (iOS needs this for the beep)
  useEffect(() => {
    primeScanAudio()
  }, [])

  const canRetry = error && error.kind !== "insecure" && error.kind !== "unsupported"

  return (
    <div className="space-y-2" onPointerDownCapture={primeScanAudio}>
      <style href="sf-scanner-scanline" precedence="default">
        {SCANLINE_CSS}
      </style>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl bg-black",
          // an error message sizes the box to its text instead of the (hidden) video
          status === "error" && error ? "bg-muted" : (className ?? "aspect-[4/3] max-h-[45dvh]")
        )}
        data-testid="camera-scanner"
        data-status={status}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-label="Camera preview"
          className="absolute inset-0 size-full object-cover"
        />

        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {/* scan window: darken everything around it */}
            <div className="absolute inset-x-[8%] top-1/2 h-[46%] -translate-y-1/2 rounded-lg shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]">
              <span className="absolute -left-px -top-px size-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-white" />
              <span className="absolute -right-px -top-px size-6 rounded-tr-lg border-r-[3px] border-t-[3px] border-white" />
              <span className="absolute -bottom-px -left-px size-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-white" />
              <span className="absolute -bottom-px -right-px size-6 rounded-br-lg border-b-[3px] border-r-[3px] border-white" />
              {!paused && (
                <span className="absolute inset-x-3 top-1/2 h-0.5 rounded-full bg-primary shadow-[0_0_12px_2px_var(--color-primary)] animate-[sf-scanline_2.2s_ease-in-out_infinite] motion-reduce:animate-none" />
              )}
            </div>
            <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
              <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                {paused ? "Paused" : hint}
              </span>
            </div>
          </div>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-sm text-white">
            <Loader2 className="size-6 animate-spin" />
            Starting camera…
          </div>
        )}

        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
            <Camera className="size-6" />
            Camera off
          </div>
        )}

        {status === "error" && error && (
          <div
            role="alert"
            className="relative flex flex-col items-center justify-center gap-2 bg-muted px-4 py-5 text-center"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background">
              <CameraOff className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">{ERROR_TITLES[error.kind]}</p>
            <p className="max-w-xs text-xs text-muted-foreground sm:text-sm">{error.message}</p>
            {canRetry && (
              <Button type="button" variant="outline" size="sm" className="mt-1" onClick={retry}>
                <RotateCw /> Try again
              </Button>
            )}
          </div>
        )}

        {flash && status === "scanning" && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center animate-in fade-in duration-150",
              flash === "success" ? "bg-success/25" : "bg-destructive/25"
            )}
            aria-hidden
          >
            <span
              className={cn(
                "flex size-16 items-center justify-center rounded-full shadow-lg animate-in zoom-in-75 duration-200",
                flash === "success" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
              )}
            >
              {flash === "success" ? <Check className="size-9" /> : <X className="size-9" />}
            </span>
          </div>
        )}

        {status === "scanning" && torchSupported && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {torchOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
          </button>
        )}
      </div>

      {(cameras.length > 1 || status === "scanning") && (
        <div className="flex items-center gap-2">
          {cameras.length > 1 ? (
            <Select value={activeCameraId ?? undefined} onValueChange={selectCamera}>
              <SelectTrigger className="h-9 min-w-0 flex-1" aria-label="Camera">
                <Camera className="mr-2 size-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Choose camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera, index) => (
                  <SelectItem key={camera.deviceId || index} value={camera.deviceId || `camera-${index}`}>
                    {camera.label || `Camera ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="flex-1" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setScanSoundEnabled(!sound)
              setSound(!sound)
            }}
            aria-pressed={sound}
            aria-label={sound ? "Mute scan beep" : "Unmute scan beep"}
            title={sound ? "Mute scan beep" : "Unmute scan beep"}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
      )}
    </div>
  )
}
