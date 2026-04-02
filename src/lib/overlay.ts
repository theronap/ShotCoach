import type { ShotOverlay } from "@/types/shot-list"

/**
 * Normalizes overlay zone coordinates from the shot spec (0-1 in reference video space)
 * to canvas pixel coordinates, accounting for the getUserMedia stream aspect ratio.
 *
 * The getUserMedia stream may be 16:9, 4:3, or other. The canvas element fills its
 * container. We letterbox or pillarbox the overlay zone to match the actual camera feed.
 */
export function computeOverlayRect(
  overlay: ShotOverlay,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; w: number; h: number } {
  // Clamp all incoming values to 0-1 range (guards against bad Claude output)
  const zx = Math.max(0, Math.min(1, overlay.zone_x))
  const zy = Math.max(0, Math.min(1, overlay.zone_y))
  const zw = Math.max(0, Math.min(1, overlay.zone_width))
  const zh = Math.max(0, Math.min(1, overlay.zone_height))

  return {
    x: zx * canvasWidth,
    y: zy * canvasHeight,
    w: zw * canvasWidth,
    h: zh * canvasHeight,
  }
}

const DIFFICULTY_COLORS = {
  easy: "#22c55e",    // green-500
  medium: "#f59e0b",  // amber-500
  hard: "#ef4444",    // red-500
} as const

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: ShotOverlay,
  difficulty: "easy" | "medium" | "hard",
  label: string
) {
  const { width: cw, height: ch } = ctx.canvas
  const rect = computeOverlayRect(overlay, cw, ch)
  const color = DIFFICULTY_COLORS[difficulty]

  // Framing zone rectangle
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.setLineDash([10, 5])
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.setLineDash([])

  // Corner accents for easier alignment
  const cornerLen = Math.min(rect.w, rect.h) * 0.15
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  const corners: [number, number, number, number][] = [
    [rect.x, rect.y, 1, 1],
    [rect.x + rect.w, rect.y, -1, 1],
    [rect.x, rect.y + rect.h, 1, -1],
    [rect.x + rect.w, rect.y + rect.h, -1, -1],
  ]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * cornerLen, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * cornerLen)
    ctx.stroke()
  }

  // Motion arrow
  if (overlay.arrow_direction && overlay.arrow_direction !== "none") {
    drawArrow(ctx, overlay.arrow_direction, cw, ch, color)
  }

  // Shot label in top-left corner
  const labelX = rect.x + 8
  const labelY = rect.y - 8
  ctx.font = "bold 14px system-ui, sans-serif"
  ctx.fillStyle = "rgba(0,0,0,0.6)"
  ctx.fillRect(labelX - 4, labelY - 16, ctx.measureText(label).width + 8, 22)
  ctx.fillStyle = "#ffffff"
  ctx.fillText(label, labelX, labelY)
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  direction: "left" | "right" | "up" | "down",
  cw: number,
  ch: number,
  color: string
) {
  const cx = cw / 2
  const cy = ch / 2
  const len = Math.min(cw, ch) * 0.12
  const headSize = len * 0.35

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 4
  ctx.globalAlpha = 0.85

  const offsets: Record<string, [number, number, number, number]> = {
    right: [cx - len / 2, cy, cx + len / 2, cy],
    left:  [cx + len / 2, cy, cx - len / 2, cy],
    down:  [cx, cy - len / 2, cx, cy + len / 2],
    up:    [cx, cy + len / 2, cx, cy - len / 2],
  }
  const [x1, y1, x2, y2] = offsets[direction]

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  // Arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headSize * Math.cos(angle - Math.PI / 6), y2 - headSize * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x2 - headSize * Math.cos(angle + Math.PI / 6), y2 - headSize * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()

  ctx.globalAlpha = 1
}
