"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Shot, ShotList } from "@/types/shot-list"
import { drawOverlay } from "@/lib/overlay"
import ShotCard from "./ShotCard"

interface Props {
  shotList: ShotList
  referenceFrameUrls?: string[]
  onSessionComplete?: (clipUrls: (string | null)[]) => void
}

type RecordingState = "idle" | "recording" | "reviewing"

export default function CameraCoach({ shotList, referenceFrameUrls = [], onSessionComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const capturedFramesRef = useRef<string[]>([])

  const [shotIndex, setShotIndex] = useState(0)
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [sessionDone, setSessionDone] = useState(false)
  const [clipUrls, setClipUrls] = useState<(string | null)[]>(
    Array(shotList.total_shots).fill(null)
  )
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [refExpanded, setRefExpanded] = useState(false)
  const recordStartRef = useRef<number>(0)

  const currentShot: Shot = shotList.shots[shotIndex]
  const isMotionShot = currentShot.motion !== "static"
  const refFrameUrl = referenceFrameUrls[currentShot.reference_frame_index]

  // Start rear camera in portrait
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",   // rear camera
            width: { ideal: 1080 },
            height: { ideal: 1920 },     // portrait 9:16
          },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setCameraError(null)
      } catch {
        // Fall back to any available camera
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }
          setCameraError(null)
        } catch {
          setCameraError("Camera access denied — check browser permissions and refresh.")
        }
      }
    }
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Canvas overlay loop — fills full screen
  useEffect(() => {
    if (cameraError) return
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    function draw() {
      if (!canvas || !video) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      canvas.width = video.videoWidth || 1080
      canvas.height = video.videoHeight || 1920
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      if (recordingState !== "reviewing") {
        drawOverlay(ctx, currentShot.overlay, currentShot.difficulty, currentShot.label)
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [currentShot, recordingState, cameraError])

  // Elapsed timer
  useEffect(() => {
    if (recordingState !== "recording") return
    const interval = setInterval(() => setElapsedMs(Date.now() - recordStartRef.current), 100)
    return () => clearInterval(interval)
  }, [recordingState])

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current
    if (!video) return null
    const offscreen = document.createElement("canvas")
    offscreen.width = 540
    offscreen.height = 960
    const ctx = offscreen.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, 540, 960)
    return offscreen.toDataURL("image/jpeg", 0.6)
  }, [])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    chunksRef.current = []
    capturedFramesRef.current = []

    const mimeType = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=h264")
      ? "video/webm;codecs=h264"
      : "video/webm"

    const mr = new MediaRecorder(streamRef.current, { mimeType })
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType })
      setRecordedBlob(blob)
      setRecordingState("reviewing")
    }
    mediaRecorderRef.current = mr
    recordStartRef.current = Date.now()
    setElapsedMs(0)
    setRecordingState("recording")
    mr.start(100)

    const durationMs = currentShot.duration_seconds * 1000
    ;[0.1, 0.5, 0.9].forEach((p) => {
      setTimeout(() => {
        const frame = captureFrame()
        if (frame) capturedFramesRef.current.push(frame)
      }, p * durationMs)
    })
  }, [currentShot.duration_seconds, captureFrame])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const handleApprove = useCallback(() => {
    if (!recordedBlob) return
    const url = URL.createObjectURL(recordedBlob)
    const updated = [...clipUrls]
    updated[shotIndex] = url
    setClipUrls(updated)
    setRecordedBlob(null)

    if (shotIndex + 1 < shotList.total_shots) {
      setShotIndex((i) => i + 1)
      setRecordingState("idle")
    } else {
      setSessionDone(true)
      onSessionComplete?.(updated)
    }
  }, [recordedBlob, clipUrls, shotIndex, shotList.total_shots, onSessionComplete])

  const handleRetake = useCallback(() => {
    setRecordedBlob(null)
    setRecordingState("idle")
  }, [])

  // ── Session complete ───────────────────────────────────────────────────────
  if (sessionDone) {
    try { sessionStorage.setItem("clip_urls", JSON.stringify(clipUrls)) } catch {}
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white px-6">
        <div className="text-center w-full max-w-sm space-y-4">
          <p className="text-5xl">🎬</p>
          <h2 className="text-2xl font-bold">All shots recorded!</h2>
          <p className="text-zinc-400">
            {shotList.total_shots} shot{shotList.total_shots !== 1 ? "s" : ""} in the can.
          </p>
          <a
            href="/stitch"
            className="block w-full py-4 bg-white text-black rounded-2xl text-lg font-semibold active:scale-95 transition-all"
          >
            Stitch &amp; Export →
          </a>
          <button
            onClick={() => {
              setShotIndex(0)
              setClipUrls(Array(shotList.total_shots).fill(null))
              setSessionDone(false)
              setRecordingState("idle")
            }}
            className="w-full py-3 bg-zinc-800 text-zinc-300 rounded-2xl font-medium active:scale-95 transition-all"
          >
            Start Over
          </button>
        </div>
      </div>
    )
  }

  // ── Camera error ───────────────────────────────────────────────────────────
  if (cameraError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white px-6">
        <div className="text-center max-w-sm space-y-3">
          <p className="text-lg font-semibold">Camera unavailable</p>
          <p className="text-sm text-zinc-400">{cameraError}</p>
        </div>
      </div>
    )
  }

  // ── Reviewing state — full screen playback ─────────────────────────────────
  if (recordingState === "reviewing" && recordedBlob) {
    return (
      <div className="relative flex flex-col min-h-screen bg-black text-white">
        <video
          src={URL.createObjectURL(recordedBlob)}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-safe pt-4">
          <div className="bg-black/60 rounded-full px-3 py-1 text-sm font-medium">
            Review take
          </div>
          {isMotionShot && (
            <div className="bg-black/60 rounded-full px-3 py-1 text-xs text-zinc-300">
              Motion — judge yourself
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="relative z-10 mt-auto px-4 pb-safe pb-8 space-y-3">
          <div className="flex gap-3">
            <button
              onClick={handleRetake}
              className="flex-1 py-4 bg-black/70 backdrop-blur-sm text-white rounded-2xl text-lg font-semibold active:scale-95 transition-all border border-white/20"
            >
              Retake
            </button>
            <button
              onClick={handleApprove}
              className="flex-1 py-4 bg-green-500 text-white rounded-2xl text-lg font-semibold active:scale-95 transition-all"
            >
              {shotIndex + 1 < shotList.total_shots ? "Next →" : "Finish ✓"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main coach view ────────────────────────────────────────────────────────
  const elapsedSec = (elapsedMs / 1000).toFixed(1)
  const targetSec = currentShot.duration_seconds
  const progress = Math.min(elapsedMs / (targetSec * 1000), 1)

  return (
    <div className="relative flex flex-col min-h-screen bg-black text-white overflow-hidden">
      {/* Full-screen camera canvas */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

      {/* Top bar — progress + shot counter */}
      <div className="relative z-10 px-4 pt-safe pt-3 space-y-2">
        <div className="flex gap-1">
          {shotList.shots.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < shotIndex ? "bg-green-400" : i === shotIndex ? "bg-white" : "bg-white/30"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
            Shot {shotIndex + 1} of {shotList.total_shots}
          </div>
          {recordingState === "recording" && (
            <div className="flex items-center gap-1.5 bg-red-600/90 rounded-full px-3 py-1 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {elapsedSec}s / {targetSec}s
            </div>
          )}
        </div>
      </div>

      {/* Reference frame PiP — top right */}
      {refFrameUrl && (
        <div className="absolute top-16 right-4 z-10">
          <button
            onClick={() => setRefExpanded((v) => !v)}
            className={`overflow-hidden rounded-xl border-2 border-white/30 transition-all ${
              refExpanded ? "w-40 h-24" : "w-20 h-12"
            }`}
          >
            <img src={refFrameUrl} alt="Reference" className="w-full h-full object-cover" />
          </button>
        </div>
      )}

      {/* Recording progress bar */}
      {recordingState === "recording" && (
        <div className="absolute bottom-40 left-4 right-4 z-10 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Bottom drawer — shot info + controls */}
      <div className="relative z-10 mt-auto">
        {/* Shot info card */}
        <div className="mx-3 mb-3 bg-black/70 backdrop-blur-md rounded-2xl p-4 space-y-2">
          <ShotCard shot={currentShot} />
          <p className="text-sm text-zinc-300 leading-relaxed">{currentShot.coaching_tip}</p>
        </div>

        {/* Action button */}
        <div className="px-4 pb-safe pb-8">
          {recordingState === "idle" && (
            <button
              onClick={startRecording}
              className="w-full py-5 bg-white text-black rounded-2xl text-xl font-bold active:scale-95 transition-all"
            >
              Record
            </button>
          )}
          {recordingState === "recording" && (
            <button
              onClick={stopRecording}
              className="w-full py-5 bg-red-600 text-white rounded-2xl text-xl font-bold active:scale-95 transition-all"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
