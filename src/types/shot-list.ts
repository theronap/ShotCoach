export interface ShotOverlay {
  zone_x: number          // 0–1, left edge of subject zone
  zone_y: number          // 0–1, top edge of subject zone
  zone_width: number      // 0–1
  zone_height: number     // 0–1
  fill_target: boolean    // true = subject should fill the zone
  arrow_direction: "left" | "right" | "up" | "down" | "none"
}

export interface Shot {
  shot_number: number
  duration_seconds: number
  label: string
  shot_type: "wide" | "medium" | "close-up" | "detail" | "overhead" | "low-angle"
  camera_angle: "eye-level" | "low" | "high" | "dutch"
  motion: "static" | "pan-left" | "pan-right" | "tilt-up" | "tilt-down" | "zoom-in" | "zoom-out" | "tracking"
  difficulty: "easy" | "medium" | "hard"
  coaching_tip: string
  reference_frame_index: number
  overlay: ShotOverlay
}

export interface ShotList {
  title: string
  total_shots: number
  shots: Shot[]
}

export interface SessionState {
  shot_list: ShotList
  frame_data_urls: string[]            // reference frames, indexed by shot
  clip_supabase_urls: (string | null)[] // null = not yet recorded
}
