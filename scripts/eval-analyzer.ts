/**
 * Eval suite for the reference analyzer.
 * Usage: npx tsx scripts/eval-analyzer.ts
 *
 * Place test videos in scripts/eval-videos/ with a matching JSON ground truth file.
 * Ground truth format: { shots: [{ shot_type: "wide" | "medium" | ... }] }
 *
 * Pass bar: ≥80% shot_type correct.
 */

import * as fs from "fs"
import * as path from "path"

const WORKER_URL = process.env.WORKER_URL ?? "http://localhost:3001"
const EVAL_DIR = path.join(__dirname, "eval-videos")
const PASS_BAR = 0.8

interface GroundTruth {
  shots: Array<{ shot_type: string }>
}

async function main() {
  if (!fs.existsSync(EVAL_DIR)) {
    console.log(`[eval] No eval-videos directory found at ${EVAL_DIR}`)
    console.log(`[eval] Create scripts/eval-videos/ and add:`)
    console.log(`[eval]   video.mp4 + video.json (ground truth)`)
    process.exit(0)
  }

  const videoFiles = fs.readdirSync(EVAL_DIR).filter((f) => f.match(/\.(mp4|mov|webm)$/i))

  if (videoFiles.length === 0) {
    console.log(`[eval] No video files found in ${EVAL_DIR}`)
    process.exit(0)
  }

  console.log(`[eval] Found ${videoFiles.length} test video(s)`)
  console.log(`[eval] Worker: ${WORKER_URL}`)
  console.log()

  let totalPredictions = 0
  let correctPredictions = 0

  for (const videoFile of videoFiles) {
    const videoPath = path.join(EVAL_DIR, videoFile)
    const truthPath = videoPath.replace(/\.[^.]+$/, ".json")

    if (!fs.existsSync(truthPath)) {
      console.warn(`[eval] No ground truth for ${videoFile} — skipping`)
      continue
    }

    const groundTruth: GroundTruth = JSON.parse(fs.readFileSync(truthPath, "utf-8"))
    console.log(`[eval] Testing: ${videoFile} (${groundTruth.shots.length} expected shots)`)

    try {
      const res = await fetch(`${WORKER_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: videoPath, videoTitle: videoFile }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`  ✗ Analyze failed: ${err}`)
        continue
      }

      const { shotList } = await res.json()
      const predictions = shotList.shots as Array<{ shot_type: string }>

      // Compare up to the shorter of predicted/ground-truth shots
      const compareCount = Math.min(predictions.length, groundTruth.shots.length)
      let fileCorrect = 0

      for (let i = 0; i < compareCount; i++) {
        const predicted = predictions[i].shot_type
        const expected = groundTruth.shots[i].shot_type
        const correct = predicted === expected
        if (correct) fileCorrect++
        console.log(`  Shot ${i + 1}: predicted="${predicted}" expected="${expected}" ${correct ? "✓" : "✗"}`)
      }

      const fileAccuracy = fileCorrect / compareCount
      console.log(`  → ${fileCorrect}/${compareCount} correct (${(fileAccuracy * 100).toFixed(0)}%)`)
      console.log()

      totalPredictions += compareCount
      correctPredictions += fileCorrect
    } catch (err) {
      console.error(`  ✗ Error: ${err}`)
    }
  }

  if (totalPredictions === 0) {
    console.log("[eval] No predictions to evaluate.")
    process.exit(1)
  }

  const overall = correctPredictions / totalPredictions
  console.log("─".repeat(50))
  console.log(`RESULT: ${correctPredictions}/${totalPredictions} correct (${(overall * 100).toFixed(1)}%)`)
  console.log(`PASS BAR: ${(PASS_BAR * 100).toFixed(0)}%`)
  console.log(overall >= PASS_BAR ? "✅ PASS" : "❌ FAIL")

  process.exit(overall >= PASS_BAR ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
