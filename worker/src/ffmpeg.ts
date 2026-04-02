import ffmpeg from "fluent-ffmpeg"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { SceneBoundary } from "./types"

/**
 * Get video duration in seconds via ffprobe.
 */
export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      resolve(metadata.format.duration ?? 0)
    })
  })
}

/**
 * Detect scene boundaries using FFmpeg's built-in scene filter.
 * Returns timestamps (in seconds) where scene changes occur.
 */
export function detectScenes(filePath: string, threshold = 0.4): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const timestamps: number[] = []

    ffmpeg(filePath)
      .videoFilters(`select='gt(scene,${threshold})',showinfo`)
      .outputOptions(["-vsync", "vfr", "-f", "null"])
      .output("/dev/null")
      .on("stderr", (line: string) => {
        // showinfo outputs lines like: "pts_time:3.456"
        const match = line.match(/pts_time:([\d.]+)/)
        if (match) {
          const t = parseFloat(match[1])
          if (!isNaN(t)) timestamps.push(t)
        }
      })
      .on("end", () => resolve(timestamps))
      .on("error", reject)
      .run()
  })
}

/**
 * Extract a single JPEG frame at the given timestamp.
 * Returns the path to the saved JPEG.
 */
export function extractFrame(
  filePath: string,
  timestamp: number,
  outputDir: string,
  index: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(outputDir, `frame_${String(index).padStart(3, "0")}.jpg`)

    ffmpeg(filePath)
      .seekInput(timestamp)
      .frames(1)
      .output(outputFile)
      .on("end", () => resolve(outputFile))
      .on("error", reject)
      .run()
  })
}

/**
 * Full scene detection + frame extraction pipeline.
 * Returns scene boundaries with extracted frame file paths.
 * Falls back to even splits if <2 scenes detected.
 */
export async function extractSceneFrames(
  filePath: string,
  maxFrames = 12
): Promise<{ boundaries: SceneBoundary[]; duration: number }> {
  const duration = await getVideoDuration(filePath)
  let timestamps = await detectScenes(filePath)

  console.log(`[ffmpeg] Duration: ${duration.toFixed(1)}s, raw scene timestamps: ${timestamps.length}`)

  // Deduplicate timestamps too close together (<1s apart)
  timestamps = timestamps.filter((t, i) => i === 0 || t - timestamps[i - 1] > 1.0)

  // Fallback: if <2 scenes, split evenly into 3–4 shots
  if (timestamps.length < 2) {
    const count = duration < 30 ? 3 : Math.min(Math.floor(duration / 8), 6)
    timestamps = Array.from({ length: count - 1 }, (_, i) => ((i + 1) / count) * duration)
    console.log(`[ffmpeg] Scene detect fallback: using ${count} even splits`)
  }

  // Cap to maxFrames
  if (timestamps.length > maxFrames) {
    const step = Math.floor(timestamps.length / maxFrames)
    timestamps = timestamps.filter((_, i) => i % step === 0).slice(0, maxFrames)
  }

  // Extract frames to a temp dir
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), "shotcoach-frames-"))
  const boundaries: SceneBoundary[] = []

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i]
    const frameFile = await extractFrame(filePath, t, frameDir, i)
    boundaries.push({ timestamp: t, frameFile })
  }

  console.log(`[ffmpeg] Extracted ${boundaries.length} frames to ${frameDir}`)
  return { boundaries, duration }
}
