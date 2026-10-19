import { describe, expect, it } from 'vitest'
import { FRAME_TARGET_PIXELS, getFrameSize } from './frameSize'
import { FALLBACK_FRAMES, LAYOUTS } from './presets'

describe('frame output size', () => {
  it('keeps the native asset ratio while normalizing its pixel budget', () => {
    const frame = { ...FALLBACK_FRAMES[0], assetUrl: 'red_4x1.png', assetWidth: 941, assetHeight: 1672 }
    const size = getFrameSize(LAYOUTS[1], frame)
    expect(size.width / size.height).toBeCloseTo(941 / 1672, 3)
    expect(Math.abs(size.width * size.height - FRAME_TARGET_PIXELS) / FRAME_TARGET_PIXELS).toBeLessThan(.01)
  })

  it('uses the layout ratio and the same pixel budget for generated frames', () => {
    const size = getFrameSize(LAYOUTS[1], FALLBACK_FRAMES[0])
    expect(size.width / size.height).toBeCloseTo(900 / 2400, 3)
    expect(Math.abs(size.width * size.height - FRAME_TARGET_PIXELS) / FRAME_TARGET_PIXELS).toBeLessThan(.01)
  })
})
