import { z } from "zod"

export const FrameAnalysisSchema = z.object({
  shot_type: z.enum(["wide", "medium", "close-up", "detail", "overhead", "low-angle"]),
  camera_angle: z.enum(["eye-level", "low", "high", "dutch"]),
  motion: z.enum(["static", "pan-left", "pan-right", "tilt-up", "tilt-down", "zoom-in", "zoom-out", "tracking"]),
  subject_position: z.enum(["center", "left", "right", "upper-third", "lower-third"]),
  coaching_tip: z.string().min(5).max(200),
})

export const FrameAnalysisBatchSchema = z.array(FrameAnalysisSchema)

export const ShotOverlaySchema = z.object({
  zone_x: z.number().min(0).max(1),
  zone_y: z.number().min(0).max(1),
  zone_width: z.number().min(0.05).max(1),
  zone_height: z.number().min(0.05).max(1),
  fill_target: z.boolean(),
  arrow_direction: z.enum(["none", "left", "right", "up", "down"]),
})

export const ShotSchema = z.object({
  shot_number: z.number().int().positive(),
  label: z.string(),
  shot_type: z.enum(["wide", "medium", "close-up", "detail", "overhead", "low-angle"]),
  camera_angle: z.enum(["eye-level", "low", "high", "dutch"]),
  motion: z.enum(["static", "pan-left", "pan-right", "tilt-up", "tilt-down", "zoom-in", "zoom-out", "tracking"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  duration_seconds: z.number().min(1).max(60),
  overlay: ShotOverlaySchema,
  coaching_tip: z.string(),
  reference_frame_index: z.number().int().min(0),
})

export const ShotListSchema = z.object({
  title: z.string(),
  total_shots: z.number().int().positive(),
  shots: z.array(ShotSchema),
})
