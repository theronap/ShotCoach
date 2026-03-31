"use client"

import type { Shot } from "@/types/shot-list"

const DIFFICULTY_STYLES = {
  easy:   "bg-green-900/50 text-green-400 border-green-800",
  medium: "bg-amber-900/50 text-amber-400 border-amber-800",
  hard:   "bg-red-900/50 text-red-400 border-red-800",
}

const MOTION_LABELS: Record<Shot["motion"], string> = {
  "static":    "Static",
  "pan-left":  "Pan ←",
  "pan-right": "Pan →",
  "tilt-up":   "Tilt ↑",
  "tilt-down": "Tilt ↓",
  "handheld":  "Handheld",
}

interface Props {
  shot: Shot
}

export default function ShotCard({ shot }: Props) {
  return (
    <div className="bg-zinc-900 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight">{shot.label}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${DIFFICULTY_STYLES[shot.difficulty]}`}>
          {shot.difficulty}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs text-zinc-400">
        <span className="bg-zinc-800 px-2 py-0.5 rounded-full">{shot.shot_type}</span>
        <span className="bg-zinc-800 px-2 py-0.5 rounded-full">{shot.camera_angle}</span>
        <span className="bg-zinc-800 px-2 py-0.5 rounded-full">{MOTION_LABELS[shot.motion]}</span>
        <span className="bg-zinc-800 px-2 py-0.5 rounded-full">{shot.duration_seconds}s</span>
      </div>
    </div>
  )
}
