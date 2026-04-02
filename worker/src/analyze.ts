import { extractSceneFrames } from "./ffmpeg"
import { analyzeAllFrames } from "./claude"
import { ShotListSchema } from "./validate"
import type { ShotList, ShotOverlay, Difficulty, FrameAnalysis, SubjectPosition } from "./types"

/**
 * Map Claude's subject_position to overlay zone coordinates (normalized 0–1).
 */
function positionToOverlay(position: SubjectPosition, motion: string): ShotOverlay {
  const motionArrow = (): ShotOverlay["arrow_direction"] => {
    if (motion === "pan-left") return "left"
    if (motion === "pan-right") return "right"
    if (motion === "tilt-up") return "up"
    if (motion === "tilt-down") return "down"
    return "none"
  }

  const base: Omit<ShotOverlay, "zone_x" | "zone_width"> = {
    zone_y: 0.1,
    zone_height: 0.8,
    fill_target: motion === "static",
    arrow_direction: motionArrow(),
  }

  switch (position) {
    case "left":        return { ...base, zone_x: 0.05, zone_width: 0.4 }
    case "right":       return { ...base, zone_x: 0.55, zone_width: 0.4 }
    case "upper-third": return { ...base, zone_x: 0.2, zone_y: 0.05, zone_width: 0.6, zone_height: 0.45 }
    case "lower-third": return { ...base, zone_x: 0.2, zone_y: 0.5, zone_width: 0.6, zone_height: 0.45 }
    case "center":
    default:            return { ...base, zone_x: 0.2, zone_width: 0.6 }
  }
}

/**
 * Derive difficulty from shot_type + motion.
 */
function deriveDifficulty(analysis: FrameAnalysis): Difficulty {
  if (analysis.motion !== "static") return "hard"
  if (analysis.shot_type === "close-up" || analysis.shot_type === "detail") return "medium"
  if (analysis.camera_angle !== "eye-level") return "medium"
  return "easy"
}

/**
 * Build shot label from shot_type and shot number.
 */
function buildLabel(shotType: string, num: number): string {
  const readable: Record<string, string> = {
    "wide": "Wide Shot",
    "medium": "Medium Shot",
    "close-up": "Close-Up",
    "detail": "Detail Shot",
    "overhead": "Overhead Shot",
    "low-angle": "Low Angle",
  }
  return `${readable[shotType] ?? shotType} #${num}`
}

/**
 * Main pipeline: video file → ShotList
 */
export async function analyzeVideo(
  filePath: string,
  videoTitle = "Reference Video"
): Promise<ShotList> {
  console.log(`[analyze] Starting pipeline for: ${filePath}`)

  // 1. Scene detection + frame extraction
  const { boundaries, duration } = await extractSceneFrames(filePath)
  console.log(`[analyze] ${boundaries.length} scenes detected, duration: ${duration.toFixed(1)}s`)

  // 2. Claude vision analysis
  const framePaths = boundaries.map((b) => b.frameFile)
  const analyses = await analyzeAllFrames(framePaths)

  // 3. Build ShotList
  // Add sentinel at end for duration calculation
  const timestamps = [...boundaries.map((b) => b.timestamp), duration]

  const shots = analyses.map((analysis, i) => {
    const shotDuration = Math.min(
      Math.max(timestamps[i + 1] - timestamps[i], 3),
      15
    )

    return {
      shot_number: i + 1,
      label: buildLabel(analysis.shot_type, i + 1),
      shot_type: analysis.shot_type,
      camera_angle: analysis.camera_angle,
      motion: analysis.motion,
      difficulty: deriveDifficulty(analysis),
      duration_seconds: parseFloat(shotDuration.toFixed(1)),
      overlay: positionToOverlay(analysis.subject_position, analysis.motion),
      coaching_tip: analysis.coaching_tip,
      reference_frame_index: i,
    }
  })

  const shotList: ShotList = {
    title: videoTitle,
    total_shots: shots.length,
    shots,
  }

  // 4. Validate
  const validated = ShotListSchema.parse(shotList)
  console.log(`[analyze] Pipeline complete — ${validated.total_shots} shots`)
  return validated
}
