import { NextResponse } from "next/server"
import { SignJWT } from "jose"

const WORKER_SECRET = process.env.WORKER_SECRET ?? "dev-secret"

export async function POST() {
  const secret = new TextEncoder().encode(WORKER_SECRET)
  const token = await new SignJWT({ role: "client" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret)

  return NextResponse.json({ token })
}
