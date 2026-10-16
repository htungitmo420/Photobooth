import { describe, expect, it } from 'vitest'
import { getFrameSize } from './frameSize'
import { FALLBACK_FRAMES, LAYOUTS } from './presets'

describe('frame output size', () => {
  it('keeps the native asset ratio for a four-photo strip', () => {
    const frame = { ...FALLBACK_FRAMES[0], assetUrl: 'red_4x1.png', assetWidth: 941, assetHeight: 1672 }
    expect(getFrameSize(LAYOUTS[1], frame)).toEqual({ width: 941, height: 1672 })
  })

  it('uses the layout size for generated frames', () => {
    expect(getFrameSize(LAYOUTS[1], FALLBACK_FRAMES[0])).toEqual({ width: 900, height: 2400 })
  })
})
