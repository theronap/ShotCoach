import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">ShotCoach</h1>
          <p className="text-zinc-400 text-lg">
            Upload a video you love. Get a shot-by-shot guide to recreate it.
          </p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-6 space-y-4 text-left">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎬</span>
            <div>
              <p className="font-medium">Upload a reference video</p>
              <p className="text-sm text-zinc-500">Any video you want to replicate</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="font-medium">Get your shot list</p>
              <p className="text-sm text-zinc-500">AI breaks it down into individual shots</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📷</span>
            <div>
              <p className="font-medium">Record with guidance</p>
              <p className="text-sm text-zinc-500">Live overlay shows exactly where to position your subject</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">✂️</span>
            <div>
              <p className="font-medium">Export for social</p>
              <p className="text-sm text-zinc-500">TikTok, Reels, and Shorts ready</p>
            </div>
          </div>
        </div>

        <Link
          href="/coach"
          className="block w-full py-4 bg-white text-black rounded-2xl text-lg font-semibold hover:bg-zinc-200 active:scale-95 transition-all text-center"
        >
          Try the prototype →
        </Link>

        <p className="text-xs text-zinc-600">
          Prototype mode: using a sample shot list. Full video analysis coming in the next build.
        </p>
      </div>
    </main>
  )
}
