import CameraCoach from "@/components/coach/CameraCoach"
import { MOCK_SHOT_LIST } from "@/lib/mock-shot-list"

// Step 0 prototype — uses the mock shot list.
// Replace MOCK_SHOT_LIST with sessionStorage-loaded ShotList after Step 2 is built.
export default function CoachPage() {
  return (
    <CameraCoach
      shotList={MOCK_SHOT_LIST}
      referenceFrameUrls={[]}  // empty until analyzer is built
    />
  )
}
