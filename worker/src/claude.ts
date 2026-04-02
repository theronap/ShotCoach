import Anthropic from "@anthropic-ai/sdk"
import * as fs from "fs"
import { FrameAnalysisBatchSchema } from "./validate"
import type { FrameAnalysis } from "./types"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a professional videographer and cinematography coach analyzing reference video frames.
For each frame, identify the cinematographic technique used so a student can recreate it.
Be concise and precise. Respond only with valid JSON.`

const FRAME_PROMPT = (count: number) => `
Analyze these ${count} video frame(s) in order. For each frame return a JSON object with:
- shot_type: one of "wide" | "medium" | "close-up" | "detail" | "overhead" | "low-angle"
- camera_angle: one of "eye-level" | "low" | "high" | "dutch"
- motion: one of "static" | "pan-left" | "pan-right" | "tilt-up" | "tilt-down" | "zoom-in" | "zoom-out" | "tracking"
- subject_position: one of "center" | "left" | "right" | "upper-third" | "lower-third"
- coaching_tip: one sentence (max 120 chars) telling a student how to frame this shot

Return a JSON array with exactly ${count} objects, one per frame, in the same order as the images.
Example: [{"shot_type":"wide","camera_angle":"eye-level","motion":"static","subject_position":"center","coaching_tip":"Stand back to capture the full scene with environment context."}]
`.trim()

/**
 * Read a frame file as a base64-encoded JPEG for the Anthropic API.
 */
function frameToBase64(framePath: string): string {
  const buffer = fs.readFileSync(framePath)
  return buffer.toString("base64")
}

/**
 * Analyze a batch of frames (up to 5) with Claude vision.
 * Returns one FrameAnalysis per frame.
 */
async function analyzeFrameBatch(framePaths: string[]): Promise<FrameAnalysis[]> {
  const imageContent: Anthropic.ImageBlockParam[] = framePaths.map((p) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: frameToBase64(p),
    },
  }))

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...imageContent,
          { type: "text", text: FRAME_PROMPT(framePaths.length) },
        ],
      },
    ],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")

  // Extract JSON array from response (may have surrounding text)
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error(`Claude did not return a JSON array. Response: ${text.slice(0, 200)}`)

  const parsed = JSON.parse(jsonMatch[0])
  const validated = FrameAnalysisBatchSchema.parse(parsed)

  if (validated.length !== framePaths.length) {
    throw new Error(`Claude returned ${validated.length} results for ${framePaths.length} frames`)
  }

  return validated
}

/**
 * Analyze all frames, batching into groups of 5.
 */
export async function analyzeAllFrames(framePaths: string[]): Promise<FrameAnalysis[]> {
  const BATCH_SIZE = 5
  const results: FrameAnalysis[] = []

  for (let i = 0; i < framePaths.length; i += BATCH_SIZE) {
    const batch = framePaths.slice(i, i + BATCH_SIZE)
    console.log(`[claude] Analyzing frames ${i + 1}–${Math.min(i + BATCH_SIZE, framePaths.length)} of ${framePaths.length}`)
    const batchResults = await analyzeFrameBatch(batch)
    results.push(...batchResults)
  }

  return results
}
