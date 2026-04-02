"use client"

import { useEffect, useRef, useState } from "react"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

type StitchState = "idle" | "loading-ffmpeg" | "processing" | "done" | "error"

export default function StitchPage() {
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const [state, setState] = useState<StitchState>("idle")
  const [log, setLog] = useState<string[]>([])
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [clipCount, setClipCount] = useState(0)

  // Read clip URLs from sessionStorage
  const clipUrls = useRef<string[]>([])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("clip_urls")
      if (raw) {
        const parsed: (string | null)[] = JSON.parse(raw)
        clipUrls.current = parsed.filter((u): u is string => u !== null)
        setClipCount(clipUrls.current.length)
      }
    } catch {
      // sessionStorage unavailable or corrupt — user can still paste blobs manually
    }
  }, [])

  function addLog(line: string) {
    setLog((prev) => [...prev, line])
  }

  async function runStitch() {
    const urls = clipUrls.current
    if (urls.length === 0) {
      addLog("No clips found in session. Go record some shots first.")
      setState("error")
      return
    }

    setState("loading-ffmpeg")
    // Check SharedArrayBuffer availability (requires COOP/COEP headers)
    if (typeof SharedArrayBuffer === "undefined") {
      addLog("⚠️  SharedArrayBuffer unavailable — COOP/COEP headers may not be active on this route.")
      addLog("Try a hard refresh (Cmd+Shift+R), or check that the dev server restarted after next.config.ts changed.")
    } else {
      addLog("SharedArrayBuffer: available ✓")
    }

    addLog("Loading FFmpeg.wasm (downloading ~31MB core, one-time)...")

    const ffmpeg = new FFmpeg()
    ffmpegRef.current = ffmpeg
    ffmpeg.on("log", ({ message }) => addLog(message))
    ffmpeg.on("progress", ({ progress }) => {
      if (progress < 1) addLog(`  progress: ${Math.round(progress * 100)}%`)
    })

    try {
      // Use multi-threaded core — SharedArrayBuffer is available (COOP/COEP headers active)
      // MT core compiles wasm in parallel threads: ~5s vs ~60s for single-threaded core
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm"
      addLog(`Fetching MT core JS...`)
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript")
      addLog(`Fetching MT core WASM (~31MB)...`)
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
      addLog(`Fetching MT worker...`)
      const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript")
      addLog(`Initializing FFmpeg (MT)...`)
      await ffmpeg.load({ coreURL, wasmURL, workerURL })
      addLog("FFmpeg.wasm loaded ✓")
    } catch (e) {
      addLog(`Failed to load FFmpeg.wasm: ${e}`)
      addLog("→ Spike result: FFmpeg.wasm load failed. Railway worker is the fallback path.")
      setState("error")
      return
    }

    setState("processing")
    addLog(`Processing ${urls.length} clip(s)...`)

    try {
      // Write each clip to FFmpeg's virtual filesystem
      const inputNames: string[] = []
      for (let i = 0; i < urls.length; i++) {
        const name = `clip${i}.webm`
        addLog(`Writing ${name}...`)
        await ffmpeg.writeFile(name, await fetchFile(urls[i]))
        inputNames.push(name)
      }

      // Build concat list
      const concatList = inputNames.map((n) => `file '${n}'`).join("\n")
      await ffmpeg.writeFile("concat.txt", concatList)
      addLog("Concat list written.")

      // Concat + reframe in a single pass to avoid double-encode
      // Re-encode (not -c copy) because browser-recorded webm files have
      // inconsistent codec headers that break stream copy concat
      addLog("Concatenating + reframing to 9:16 (single pass)...")
      const t0 = Date.now()
      await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat.txt",
        // Center-crop 16:9 source to 9:16: scale up height, crop width
        "-vf", "scale=-2:1920,crop=1080:1920",
        "-c:v", "libx264",
        "-preset", "ultrafast",   // fastest encode, larger file — fine for spike
        "-crf", "28",
        "-an",
        "output.mp4",
      ])
      addLog(`Concat + reframe done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

      // Read output
      const data = await ffmpeg.readFile("output.mp4")
      const blob = new Blob([data as unknown as ArrayBuffer], { type: "video/mp4" })
      setOutputUrl(URL.createObjectURL(blob))
      addLog(`Output: ${(blob.size / 1024 / 1024).toFixed(1)} MB`)
      setState("done")
    } catch (e) {
      addLog(`Processing error: ${e}`)
      setState("error")
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stitch Spike</h1>
        <p className="text-zinc-400 text-sm mt-1">
          FFmpeg.wasm concat + 9:16 reframe — running entirely in the browser
        </p>
      </div>

      {clipCount > 0 ? (
        <p className="text-zinc-300 text-sm">
          Found <span className="text-white font-medium">{clipCount} clip{clipCount !== 1 ? "s" : ""}</span> from your session.
        </p>
      ) : (
        <p className="text-amber-400 text-sm">
          No clips found in session storage. Record shots first, then come back here.
        </p>
      )}

      {state === "idle" && (
        <button
          onClick={runStitch}
          disabled={clipCount === 0}
          className="w-full py-4 bg-white text-black rounded-2xl text-lg font-semibold hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Stitch {clipCount > 0 ? `${clipCount} Clips` : "Clips"} →
        </button>
      )}

      {(state === "loading-ffmpeg" || state === "processing") && (
        <div className="flex items-center gap-3 text-zinc-300 text-sm">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {state === "loading-ffmpeg" ? "Loading FFmpeg.wasm..." : "Processing..."}
        </div>
      )}

      {log.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 font-mono text-xs text-zinc-400 space-y-0.5 max-h-64 overflow-y-auto">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {state === "done" && outputUrl && (
        <div className="space-y-3">
          <video
            src={outputUrl}
            className="w-full rounded-xl bg-zinc-900 max-h-96 object-contain"
            controls
            autoPlay
            muted
            loop
          />
          <a
            href={outputUrl}
            download="shotcoach-output.mp4"
            className="block w-full py-3 bg-green-600 text-white rounded-2xl text-center font-semibold hover:bg-green-500 active:scale-95 transition-all"
          >
            Download MP4
          </a>
        </div>
      )}

      {state === "error" && (
        <p className="text-red-400 text-sm">
          Something went wrong — check the log above. If FFmpeg.wasm failed to load, Railway worker is the fallback path.
        </p>
      )}

      <a href="/coach" className="block text-center text-zinc-500 text-sm hover:text-zinc-300 transition-colors">
        ← Back to coach
      </a>
    </main>
  )
}
