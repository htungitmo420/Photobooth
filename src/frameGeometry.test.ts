import { describe, expect, it } from 'vitest'
import { detectTransparentSlots } from './frameGeometry'

function frameWithHoles(width: number, height: number, holes: Array<[number, number, number, number]>) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  pixels.fill(255)
  holes.forEach(([left, top, holeWidth, holeHeight]) => {
    for (let y = top; y < top + holeHeight; y += 1) {
      for (let x = left; x < left + holeWidth; x += 1) pixels[(y * width + x) * 4 + 3] = 0
    }
  })
  return pixels
}

describe('detectTransparentSlots', () => {
  it('finds and orders enclosed photo openings', () => {
    const pixels = frameWithHoles(100, 200, [[15, 12, 70, 45], [15, 70, 70, 45], [15, 128, 70, 45]])
    expect(detectTransparentSlots(pixels, 100, 200, 3)).toEqual([
      { x: 15, y: 12, width: 70, height: 45 },
      { x: 15, y: 70, width: 70, height: 45 },
      { x: 15, y: 128, width: 70, height: 45 },
    ])
  })

  it('ignores transparent space connected to an outer edge', () => {
    const pixels = frameWithHoles(100, 100, [[0, 0, 12, 100], [20, 20, 25, 25], [55, 20, 25, 25], [20, 55, 25, 25], [55, 55, 25, 25]])
    expect(detectTransparentSlots(pixels, 100, 100, 4)).toHaveLength(4)
  })
})
