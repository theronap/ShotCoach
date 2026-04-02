"use client"

import { useEffect, useState } from "react"
import CameraCoach from "@/components/coach/CameraCoach"
import { MOCK_SHOT_LIST } from "@/lib/mock-shot-list"
import type { ShotList } from "@/types/shot-list"

export default function CoachPage() {
  const [shotList, setShotList] = useState<ShotList>(MOCK_SHOT_LIST)
  const [referenceFrameUrls, setReferenceFrameUrls] = useState<string[]>([])
  const [source, setSource] = useState<"mock" | "analyzed">("mock")

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("shot_list")
      const framesRaw = sessionStorage.getItem("reference_frame_urls")
      if (raw) {
        setShotList(JSON.parse(raw))
        setSource("analyzed")
      }
      if (framesRaw) {
        setReferenceFrameUrls(JSON.parse(framesRaw))
      }
    } catch {
      // sessionStorage unavailable or corrupt — fall back to mock
    }
  }, [])

  return (
    <div className="relative">
      {source === "mock" && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-zinc-800 text-zinc-400 text-xs px-3 py-1 rounded-full pointer-events-none">
          Sample shot list
        </div>
      )}
      <CameraCoach
        shotList={shotList}
        referenceFrameUrls={referenceFrameUrls}
      />
    </div>
  )
}
