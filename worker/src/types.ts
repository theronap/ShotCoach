// Mirrors /src/types/shot-list.ts — keep in sync

export type ShotType = "wide" | "medium" | "close-up" | "detail" | "overhead" | "low-angle"
export type CameraAngle = "eye-level" | "low" | "high" | "dutch"
export type MotionType = "static" | "pan-left" | "pan-right" | "tilt-up" | "tilt-down" | "zoom-in" | "zoom-out" | "tracking"
export type SubjectPosition = "center" | "left" | "right" | "upper-third" | "lower-third"
export type Difficulty = "easy" | "medium" | "hard"

export interface ShotOverlay {
  zone_x: number       // 0–1 normalized
  zone_y: number
  zone_width: number
  zone_height: number
  fill_target: boolean
  arrow_direction: "none" | "left" | "right" | "up" | "down"
}

export interface Shot {
  shot_number: number
  label: string
  shot_type: ShotType
  camera_angle: CameraAngle
  motion: MotionType
  difficulty: Difficulty
  duration_seconds: number
  overlay: ShotOverlay
  coaching_tip: string
  reference_frame_index: number
}

export interface ShotList {
  title: string
  total_shots: number
  shots: Shot[]
}

// Claude vision output per frame
export interface FrameAnalysis {
  shot_type: ShotType
  camera_angle: CameraAngle
  motion: MotionType
  subject_position: SubjectPosition
  coaching_tip: string
}

// Internal: scene boundary from FFmpeg
export interface SceneBoundary {
  timestamp: number   // seconds
  frameFile: string   // path to extracted JPEG
}
