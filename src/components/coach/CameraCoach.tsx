"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Shot, ShotList } from "@/types/shot-list"
import { drawOverlay } from "@/lib/overlay"
import ShotCard from "./ShotCard"

interface Props {
  shotList: ShotList
  referenceFrameUrls?: string[]  // data URLs; empty in prototype
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
  // Frame capture refs for take reviewer
  const captureTimerRef = useRef<NodeJS.Timeout | null>(null)
  const capturedFramesRef = useRef<string[]>([])

  const [shotIndex, setShotIndex] = useState(0)
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [clipUrls, setClipUrls] = useState<(string | null)[]>(
    Array(shotList.total_shots).fill(null)
  )
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const recordStartRef = useRef<number>(0)

  const currentShot: Shot = shotList.shots[shotIndex]
  const isMotionShot = currentShot.motion !== "static"

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
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
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Canvas overlay loop
  useEffect(() => {
    if (cameraError) return
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    function draw() {
      if (!canvas || !video) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      if (recordingState !== "reviewing") {
        drawOverlay(ctx, currentShot.overlay, currentShot.difficulty, currentShot.label)
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [currentShot, recordingState, cameraError])

  // Elapsed timer during recording
  useEffect(() => {
    if (recordingState !== "recording") return
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - recordStartRef.current)
    }, 100)
    return () => clearInterval(interval)
  }, [recordingState])

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current
    if (!video) return null
    const offscreen = document.createElement("canvas")
    offscreen.width = 320
    offscreen.height = 240
    const ctx = offscreen.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, 320, 240)
    return offscreen.toDataURL("image/jpeg", 0.6)
  }, [])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    chunksRef.current = []
    capturedFramesRef.current = []

    const mr = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4",
    })
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

    // Capture frames at 10%, 50%, 90% of target duration
    const durationMs = currentShot.duration_seconds * 1000
    const snapTimes = [0.1, 0.5, 0.9].map((p) => p * durationMs)
    snapTimes.forEach((t) => {
      setTimeout(() => {
        const frame = captureFrame()
        if (frame) capturedFramesRef.current.push(frame)
      }, t)
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
      onSessionComplete?.(updated)
    }
  }, [recordedBlob, clipUrls, shotIndex, shotList.total_shots, onSessionComplete])

  const handleRetake = useCallback(() => {
    setRecordedBlob(null)
    setRecordingState("idle")
  }, [])

  if (cameraError) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center max-w-sm p-6">
          <p className="text-lg font-semibold mb-2">Camera unavailable</p>
          <p className="text-sm text-zinc-400">{cameraError}</p>
        </div>
      </div>
    )
  }

  const refFrameUrl = referenceFrameUrls[currentShot.reference_frame_index]
  const elapsedSec = (elapsedMs / 1000).toFixed(1)
  const targetSec = currentShot.duration_seconds

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Shot progress bar */}
      <div className="flex gap-1 px-4 pt-3">
        {shotList.shots.map((s, i) => (
          <div
            key={s.shot_number}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < shotIndex ? "bg-green-500" : i === shotIndex ? "bg-white" : "bg-zinc-700"
            }`}
          />
        ))}
      </div>

      {/* Main panels */}
      <div className="flex flex-1 gap-3 p-4 min-h-0">
        {/* Live camera / canvas */}
        <div className="relative flex-1 bg-zinc-900 rounded-xl overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
          {recordingState === "recording" && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 rounded-full px-3 py-1 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              REC {elapsedSec}s / {targetSec}s
            </div>
          )}
        </div>

        {/* Reference frame + shot info */}
        <div className="w-64 flex flex-col gap-3">
          {/* Reference frame */}
          <div className="bg-zinc-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
            {refFrameUrl ? (
              <img src={refFrameUrl} alt="Reference" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-zinc-500 p-4 text-sm">
                <p className="text-2xl mb-1">🎬</p>
                <p>Reference frame will appear after analysis</p>
              </div>
            )}
          </div>

          {/* Shot card */}
          <ShotCard shot={currentShot} />

          {/* Coaching tip */}
          <div className="bg-zinc-800 rounded-xl p-3 text-sm text-zinc-300 leading-relaxed">
            {currentShot.coaching_tip}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-6">
        {recordingState === "idle" && (
          <button
            onClick={startRecording}
            className="w-full py-4 bg-white text-black rounded-2xl text-lg font-semibold hover:bg-zinc-200 active:scale-95 transition-all"
          >
            Record Shot {shotIndex + 1} of {shotList.total_shots}
          </button>
        )}

        {recordingState === "recording" && (
          <button
            onClick={stopRecording}
            className="w-full py-4 bg-red-600 text-white rounded-2xl text-lg font-semibold hover:bg-red-700 active:scale-95 transition-all"
          >
            Stop Recording
          </button>
        )}

        {recordingState === "reviewing" && (
          <div className="space-y-3">
            {recordedBlob && (
              <video
                src={URL.createObjectURL(recordedBlob)}
                className="w-full max-h-32 rounded-xl bg-zinc-900 object-contain"
                controls
                autoPlay
                muted
                loop
              />
            )}
            {isMotionShot && (
              <p className="text-xs text-zinc-400 text-center">
                Motion shots are hard to evaluate automatically — judge this one yourself.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 py-3 bg-zinc-700 text-white rounded-xl font-medium hover:bg-zinc-600 active:scale-95 transition-all"
              >
                Retake
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-500 active:scale-95 transition-all"
              >
                {shotIndex + 1 < shotList.total_shots ? "Approve → Next Shot" : "Approve → Finish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
