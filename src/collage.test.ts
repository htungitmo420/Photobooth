import { describe, expect, it } from 'vitest'
import { createTwoStripCollage, getCollageItemSize, getCollageSize } from './collage'

describe('collage geometry', () => {
  it('uses social export dimensions for each format', () => {
    expect(getCollageSize('landscape')).toMatchObject({ width: 1920, height: 1080 })
    expect(getCollageSize('story')).toMatchObject({ width: 1080, height: 1920 })
    expect(getCollageSize('portrait')).toMatchObject({ width: 1080, height: 1350 })
    expect(getCollageSize('square')).toMatchObject({ width: 1080, height: 1080 })
  })

  it('creates two distinct angled copies inside the canvas', () => {
    const items = createTwoStripCollage(['left', 'right'])
    expect(items).toHaveLength(2)
    expect(items[0].rotation).toBeLessThan(0)
    expect(items[1].rotation).toBeGreaterThan(0)
    expect(items.every((item) => item.x > 0 && item.x < 1 && item.y > 0 && item.y < 1)).toBe(true)
  })

  it('preserves the photobooth aspect ratio when resized', () => {
    const [item] = createTwoStripCollage(['left', 'right'])
    const size = getCollageItemSize(item, 1080, 900, 2400)
    expect(size.width).toBeCloseTo(453.6)
    expect(size.height).toBeCloseTo(1209.6)
  })
})
