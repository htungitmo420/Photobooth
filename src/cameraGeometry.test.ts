import { describe, expect, it } from 'vitest'
import { clampCameraTransform, getSourceCrop } from './cameraGeometry'

describe('camera geometry', () => {
  it('creates a centered cover crop without exposing source edges', () => {
    expect(getSourceCrop(1920, 1080, 4 / 3, { zoom: 1, offsetX: 0, offsetY: 0 })).toEqual({
      x: 240, y: 0, width: 1440, height: 1080,
    })
  })

  it('keeps a zoomed and panned crop inside the source', () => {
    const crop = getSourceCrop(1280, 720, 4 / 3, { zoom: 2, offsetX: 1, offsetY: -1 })
    expect(crop.x).toBeGreaterThanOrEqual(0)
    expect(crop.y).toBeGreaterThanOrEqual(0)
    expect(crop.x + crop.width).toBeLessThanOrEqual(1280)
    expect(crop.y + crop.height).toBeLessThanOrEqual(720)
  })

  it('clamps unsafe input', () => {
    expect(clampCameraTransform({ zoom: 8, offsetX: -4, offsetY: 5 })).toEqual({ zoom: 3, offsetX: -1, offsetY: 1 })
  })
})
