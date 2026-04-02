import express from "express"
import cors from "cors"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import * as http from "http"
import * as https from "https"
import jwt from "jsonwebtoken"
import { analyzeVideo } from "./analyze"

const app = express()
const PORT = process.env.PORT ?? 3001
const WORKER_SECRET = process.env.WORKER_SECRET ?? "dev-secret"
const IS_DEV = process.env.NODE_ENV !== "production"

app.use(cors())
app.use(express.json())

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  // Skip auth in local dev for convenience
  if (IS_DEV) { next(); return }

  const auth = req.headers.authorization
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Bearer token" })
    return
  }
  try {
    jwt.verify(auth.slice(7), WORKER_SECRET)
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

// ── Health check ───────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, env: IS_DEV ? "dev" : "production" })
})

// ── Analyze endpoint ───────────────────────────────────────────────────────────
app.post("/analyze", requireAuth, async (req, res) => {
  const { fileUrl, videoTitle } = req.body as { fileUrl?: string; videoTitle?: string }

  if (!fileUrl) {
    res.status(400).json({ error: "fileUrl is required" })
    return
  }

  let tmpFile: string | null = null

  try {
    // Download or use local file
    if (fileUrl.startsWith("/tmp/") || fileUrl.startsWith(os.tmpdir())) {
      // Local file path (dev mode)
      tmpFile = fileUrl
      console.log(`[worker] Using local file: ${tmpFile}`)
    } else {
      // Download from URL
      tmpFile = path.join(os.tmpdir(), `shotcoach-dl-${Date.now()}.mp4`)
      console.log(`[worker] Downloading: ${fileUrl}`)
      await downloadFile(fileUrl, tmpFile)
    }

    const shotList = await analyzeVideo(tmpFile, videoTitle ?? "Reference Video")
    res.json({ ok: true, shotList })
  } catch (err) {
    console.error("[worker] Error:", err)
    res.status(500).json({ error: String(err) })
  } finally {
    // Clean up downloaded file (not local dev files)
    if (tmpFile && !req.body.fileUrl?.startsWith("/tmp/")) {
      fs.unlink(tmpFile, () => {})
    }
  }
})

// ── File download helper ───────────────────────────────────────────────────────
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const get = url.startsWith("https") ? https.get : http.get
    get(url, (response) => {
      response.pipe(file)
      file.on("finish", () => file.close(() => resolve()))
    }).on("error", (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[worker] Running on http://localhost:${PORT}`)
  console.log(`[worker] Auth: ${IS_DEV ? "DISABLED (dev mode)" : "JWT required"}`)
  console.log(`[worker] ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "set ✓" : "MISSING ✗"}`)
})
