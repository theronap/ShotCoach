import type { ShotList } from "@/types/shot-list"

// Step 0 prototype: hardcoded shot list from a travel vlog reference video.
// Used to validate the coaching UX before building the analyzer.
export const MOCK_SHOT_LIST: ShotList = {
  reference_video_id: "mock-001",
  total_shots: 3,
  b_roll_suggestions: [
    "Close-up of hands or feet for texture and pacing",
    "Wide environmental shot showing the full location",
  ],
  shots: [
    {
      shot_number: 1,
      duration_seconds: 4,
      label: "Wide establishing shot",
      shot_type: "wide",
      camera_angle: "eye-level",
      motion: "static",
      difficulty: "easy",
      coaching_tip: "Stand far back so your subject fills only the lower third of the frame. Let the environment tell the story.",
      reference_frame_index: 0,
      overlay: {
        zone_x: 0.35,
        zone_y: 0.55,
        zone_width: 0.30,
        zone_height: 0.40,
        fill_target: 0.15,
        arrow_direction: null,
      },
    },
    {
      shot_number: 2,
      duration_seconds: 5,
      label: "Medium walking shot",
      shot_type: "medium",
      camera_angle: "eye-level",
      motion: "pan-right",
      difficulty: "medium",
      coaching_tip: "Follow your subject as they walk. Start panning before they move and end after they stop — don't chase them.",
      reference_frame_index: 1,
      overlay: {
        zone_x: 0.25,
        zone_y: 0.15,
        zone_width: 0.50,
        zone_height: 0.70,
        fill_target: 0.40,
        arrow_direction: "right",
      },
    },
    {
      shot_number: 3,
      duration_seconds: 3,
      label: "Close-up detail shot",
      shot_type: "close-up",
      camera_angle: "low-angle",
      motion: "static",
      difficulty: "easy",
      coaching_tip: "Get close — uncomfortably close. The detail should fill most of the frame. Shoot from slightly below for drama.",
      reference_frame_index: 2,
      overlay: {
        zone_x: 0.20,
        zone_y: 0.15,
        zone_width: 0.60,
        zone_height: 0.70,
        fill_target: 0.65,
        arrow_direction: null,
      },
    },
  ],
}
