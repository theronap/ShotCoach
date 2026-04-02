import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import * as crypto from "crypto"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const allowedTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"]
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|avi)$/i)) {
    return NextResponse.json({ error: "File must be a video (mp4, mov, webm, avi)" }, { status: 400 })
  }

  const MAX_SIZE = 500 * 1024 * 1024 // 500MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 500MB)" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    // Compute hash for cache lookup (first 1MB is enough for dedup)
    const hashBuffer = buffer.length > 1_000_000 ? buffer.slice(0, 1_000_000) : buffer
    const videoHash = crypto.createHash("sha256").update(hashBuffer).digest("hex").slice(0, 16)

    // Save to /tmp for worker to pick up (dev only — production uses Supabase Storage)
    const ext = path.extname(file.name) || ".mp4"
    const tmpPath = path.join(os.tmpdir(), `shotcoach-${videoHash}${ext}`)
    fs.writeFileSync(tmpPath, buffer)

    console.log(`[upload] Saved ${(buffer.length / 1024 / 1024).toFixed(1)}MB to ${tmpPath}`)

    return NextResponse.json({
      ok: true,
      fileUrl: tmpPath,
      videoHash,
      fileName: file.name,
      fileSizeMb: parseFloat((buffer.length / 1024 / 1024).toFixed(1)),
    })
  } catch (err) {
    console.error("[upload] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
