import type { SlotRect } from './layoutGeometry'
import type { BoothLayout } from './types'

interface Component extends SlotRect {
  area: number
  touchesEdge: boolean
}

export function detectTransparentSlots(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  expectedSlots: number,
): SlotRect[] {
  const visited = new Uint8Array(width * height)
  const components: Component[] = []
  const isTransparent = (index: number) => pixels[index * 4 + 3] <= 48

  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || !isTransparent(start)) continue
    const stack = [start]
    visited[start] = 1
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let area = 0
    let touchesEdge = false

    while (stack.length > 0) {
      const index = stack.pop()!
      const x = index % width
      const y = Math.floor(index / width)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      area += 1
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true

      const neighbours = [index - 1, index + 1, index - width, index + width]
      for (const neighbour of neighbours) {
        if (neighbour < 0 || neighbour >= visited.length || visited[neighbour]) continue
        const neighbourX = neighbour % width
        if (Math.abs(neighbourX - x) > 1 || !isTransparent(neighbour)) continue
        visited[neighbour] = 1
        stack.push(neighbour)
      }
    }

    components.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area, touchesEdge })
  }

  const candidates = components
    .filter((item) => !item.touchesEdge)
    .filter((item) => item.area >= width * height * 0.015)
    .filter((item) => item.width >= width * 0.16 && item.height >= height * 0.07)
    .sort((a, b) => b.area - a.area)
    .slice(0, expectedSlots)

  if (candidates.length !== expectedSlots) return []
  return candidates.sort((a, b) => {
    const rowTolerance = Math.min(a.height, b.height) * 0.35
    return Math.abs(a.y - b.y) <= rowTolerance ? a.x - b.x : a.y - b.y
  }).map(({ x, y, width: slotWidth, height: slotHeight }) => ({ x, y, width: slotWidth, height: slotHeight }))
}

export function slotsMatchLayout(slots: SlotRect[], layout: BoothLayout): boolean {
  if (slots.length !== layout.slots) return false
  const centerY = (slot: SlotRect) => slot.y + slot.height / 2
  const sameRow = (a: SlotRect, b: SlotRect) => Math.abs(centerY(a) - centerY(b)) < Math.min(a.height, b.height) * 0.35
  if (layout.kind === 'strip') {
    return slots.every((slot, index) => index === 0 || !sameRow(slots[index - 1], slot))
  }
  if (layout.kind === 'polaroid') return slots.length === 1
  return sameRow(slots[0], slots[1]) && sameRow(slots[2], slots[3]) && !sameRow(slots[1], slots[2])
}
