"use client"

import { useRef, useState } from "react"
import type { ShotList } from "@/types/shot-list"

type UploadState = "idle" | "uploading" | "analyzing" | "done" | "error"

interface Props {
  onShotListReady: (shotList: ShotList, referenceFrameUrls: string[]) => void
}

export default function UploadPanel({ onShotListReady }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    setState("uploading")
    setProgress(0)
    setStatusMsg(`Uploading ${file.name}…`)

    try {
      // 1. Upload via XHR (for progress)
      const uploadResult = await uploadWithProgress(file, (pct) => {
        setProgress(pct)
        setStatusMsg(`Uploading… ${pct}%`)
      })

      setStatusMsg("Getting worker config…")
      setState("analyzing")
      setProgress(0)

      // 2. Get worker URL + token
      const [configRes, tokenRes] = await Promise.all([
        fetch("/api/worker-config").then((r) => r.json()),
        fetch("/api/worker-token", { method: "POST" }).then((r) => r.json()),
      ])

      if (configRes.error) throw new Error(`Worker config: ${configRes.error}`)
      if (tokenRes.error) throw new Error(`Worker token: ${tokenRes.error}`)

      const { workerUrl } = configRes
      const { token } = tokenRes

      setStatusMsg("Analyzing video with AI… (this takes ~30s)")

      // 3. Call worker
      const analyzeRes = await fetch(`${workerUrl}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileUrl: uploadResult.fileUrl,
          videoTitle: file.name.replace(/\.[^.]+$/, ""),
        }),
      })

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({ error: analyzeRes.statusText }))
        throw new Error(`Analyze failed: ${err.error ?? analyzeRes.statusText}`)
      }

      const { shotList } = await analyzeRes.json()

      setStatusMsg(`Got ${shotList.total_shots} shots!`)
      setState("done")

      // Reference frames: empty for now (Step 3 wires these up)
      onShotListReady(shotList, [])
    } catch (err) {
      console.error(err)
      setError(String(err))
      setState("error")
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="w-full max-w-lg space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => state === "idle" && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
          ${dragOver ? "border-white bg-zinc-800" : "border-zinc-700 hover:border-zinc-500"}
          ${state !== "idle" && state !== "error" ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="text-4xl mb-3">🎬</div>
        <p className="text-white font-semibold text-lg">Drop a reference video</p>
        <p className="text-zinc-400 text-sm mt-1">MP4, MOV, or WebM · max 500MB</p>
      </div>

      {/* Progress / status */}
      {(state === "uploading" || state === "analyzing") && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-zinc-300 text-sm">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
          {state === "uploading" && progress > 0 && (
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {state === "done" && (
        <p className="text-green-400 text-sm text-center">{statusMsg}</p>
      )}

      {state === "error" && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 space-y-2">
          <p className="text-red-400 text-sm font-medium">Something went wrong</p>
          <p className="text-red-300 text-xs font-mono break-all">{error}</p>
          <button
            onClick={() => { setState("idle"); setError(null) }}
            className="text-xs text-red-400 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

// XHR upload with progress callback
function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void
): Promise<{ fileUrl: string; videoHash: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append("file", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload")

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    }

    xhr.onerror = () => reject(new Error("Upload network error"))
    xhr.send(formData)
  })
}
