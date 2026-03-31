export interface ShotOverlay {
  zone_x: number        // 0-1, left edge of subject zone
  zone_y: number        // 0-1, top edge of subject zone
  zone_width: number    // 0-1
  zone_height: number   // 0-1
  fill_target: number   // 0-1, how much of frame subject should occupy
  arrow_direction: "left" | "right" | "up" | "down" | null
}

export interface Shot {
  shot_number: number
  duration_seconds: number
  label: string
  shot_type: "wide" | "medium" | "close-up" | "extreme-close-up"
  camera_angle: "eye-level" | "low-angle" | "high-angle" | "dutch"
  motion: "static" | "pan-left" | "pan-right" | "tilt-up" | "tilt-down" | "handheld"
  difficulty: "easy" | "medium" | "hard"
  coaching_tip: string
  reference_frame_index: number
  overlay: ShotOverlay
}

export interface ShotList {
  reference_video_id: string
  total_shots: number
  b_roll_suggestions: string[]
  shots: Shot[]
}

export interface SessionState {
  shot_list: ShotList
  frame_data_urls: string[]           // reference frames, indexed by shot
  clip_supabase_urls: (string | null)[] // null = not yet recorded
}
