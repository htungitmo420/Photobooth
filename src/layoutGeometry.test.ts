import { describe, expect, it } from 'vitest'
import { getLayoutSlots } from './layoutGeometry'
import { LAYOUTS } from './presets'

function overlaps(a: ReturnType<typeof getLayoutSlots>[number], b: ReturnType<typeof getLayoutSlots>[number]) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

describe('getLayoutSlots', () => {
  it.each(LAYOUTS)('creates valid slots for $name', (layout) => {
    const slots = getLayoutSlots(layout, layout.width, layout.height)

    expect(slots).toHaveLength(layout.slots)
    for (const slot of slots) {
      expect(slot.width).toBeGreaterThan(0)
      expect(slot.height).toBeGreaterThan(0)
      expect(slot.x).toBeGreaterThanOrEqual(0)
      expect(slot.y).toBeGreaterThanOrEqual(0)
      expect(slot.x + slot.width).toBeLessThanOrEqual(layout.width)
      expect(slot.y + slot.height).toBeLessThan(layout.height)
    }

    for (let first = 0; first < slots.length; first += 1) {
      for (let second = first + 1; second < slots.length; second += 1) {
        expect(overlaps(slots[first], slots[second])).toBe(false)
      }
    }
  })

  it('scales geometry proportionally for preview rendering', () => {
    const layout = LAYOUTS.find((item) => item.id === 'strip4')!
    const full = getLayoutSlots(layout, layout.width, layout.height)
    const preview = getLayoutSlots(layout, layout.width / 2, layout.height / 2)

    preview.forEach((slot, index) => {
      expect(slot.x).toBeCloseTo(full[index].x / 2)
      expect(slot.y).toBeCloseTo(full[index].y / 2)
      expect(slot.width).toBeCloseTo(full[index].width / 2)
      expect(slot.height).toBeCloseTo(full[index].height / 2)
    })
  })

  it('keeps the Polaroid photo square with a wide caption area below', () => {
    const layout = LAYOUTS.find((item) => item.id === 'polaroid')!
    const [photo] = getLayoutSlots(layout, layout.width, layout.height)

    expect(photo.width).toBeCloseTo(photo.height)
    expect(photo.y + photo.height).toBeLessThan(layout.height * 0.8)
    expect(layout.height - photo.y - photo.height).toBeGreaterThan(layout.height * 0.2)
  })
})
