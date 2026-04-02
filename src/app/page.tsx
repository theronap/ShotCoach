"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import UploadPanel from "@/components/upload/UploadPanel"
import type { ShotList } from "@/types/shot-list"

export default function Home() {
  const router = useRouter()

  function handleShotListReady(shotList: ShotList, referenceFrameUrls: string[]) {
    // Persist to sessionStorage, then navigate to coach
    sessionStorage.setItem("shot_list", JSON.stringify(shotList))
    sessionStorage.setItem("reference_frame_urls", JSON.stringify(referenceFrameUrls))
    router.push("/coach")
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">ShotCoach</h1>
          <p className="text-zinc-400 text-lg">
            Upload a video you love. Get a shot-by-shot guide to recreate it.
          </p>
        </div>

        <UploadPanel onShotListReady={handleShotListReady} />

        <div className="flex items-center gap-3 text-zinc-600">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs">or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        <Link
          href="/coach"
          className="block w-full py-3 bg-zinc-900 text-zinc-400 rounded-2xl font-medium hover:bg-zinc-800 hover:text-white active:scale-95 transition-all text-center text-sm"
        >
          Try the prototype with sample shots →
        </Link>
      </div>
    </main>
  )
}
