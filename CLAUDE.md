# SocialMediaSoftware (ShotCoach)

Video production coaching app for non-videographers. Upload a reference video, AI produces a shot list, camera coach UI walks you through each shot with Canvas overlay, record clips, stitch and export for TikTok/Reels/Shorts.

## Tech Stack
- Next.js 16 (App Router, React 19, TypeScript strict)
- Tailwind CSS 4
- Vercel AI SDK + Claude (vision for shot analysis + take review)
- Supabase Storage (clips + output videos)
- Railway worker: Node.js + FFmpeg (video processing)
- Vitest + Playwright (tests)

## Directory Structure
```
src/
  app/
    api/
      worker-token/ # Issues short-lived JWT for Railway worker calls
    coach/          # Camera coach UI
    analyze/        # Shot list display after analysis (Step 2+)
    stitch/         # Stitch + export (Step 5+)
  components/
    coach/          # CameraCoach, ShotCard
    ui/             # Shared primitives
  lib/
    mock-shot-list.ts
    overlay.ts
    session-state.ts    # (Step 2+)
    style-library.ts    # (Step 6+)
    shot-list-schema.ts # Zod schema (Step 2+)
  types/
    shot-list.ts
  test/
eval/               # Analyzer prompt eval suite (Step 2+)
worker/             # Railway Node.js+FFmpeg service (Step 2+)
```

## Build Order
- Step 0 (current): Prototype with mock shot list — validate coaching UX with real users
- Step 1: FFmpeg.wasm spike
- Step 2: Reference analyzer + eval suite
- Step 3-4: Camera coach full + recording + AI take reviewer
- Step 5: Stitch + export presets
- Step 6: Style library

## Key Decisions
- Worker auth: short-lived JWT from /api/worker-token (5-min TTL)
- Shot list cache: Supabase analyzed_videos table
- Session state: sessionStorage { shot_list, frame_data_urls, clip_supabase_urls: (string|null)[] }
- FFmpeg.wasm COOP/COEP headers scoped to /stitch route only
- All Claude JSON output validated with Zod + overlay coords clamped to 0-1
- Upload progress: XMLHttpRequest onprogress (not fetch)

## Testing
- Run: npm test (Vitest)
- Eval: npx tsx eval/analyzer-prompt.eval.ts (Step 2+)
- Passing bar for analyzer eval: ≥80% shot_type correct, ≥70% overlay zone plausible

## Critical Gaps (fix before launch)
1. Railway worker OOM — wrap FFmpeg, return graceful error
2. sessionStorage write failure — try/catch all writes
3. FFmpeg.wasm backgrounding — visibilitychange warning

## Rules
- Planning-first. Never build without explicit go-ahead.
- Run npm test after every change.
- No hardcoded colors — Tailwind classes only.
