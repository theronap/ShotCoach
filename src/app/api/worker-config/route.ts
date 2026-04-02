import { NextResponse } from "next/server"

export function GET() {
  const workerUrl =
    process.env.WORKER_URL ??
    (process.env.NODE_ENV === "production"
      ? null
      : "http://localhost:3001")

  if (!workerUrl) {
    return NextResponse.json({ error: "WORKER_URL not configured" }, { status: 503 })
  }

  return NextResponse.json({ workerUrl })
}
