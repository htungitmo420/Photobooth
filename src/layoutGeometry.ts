import type { BoothLayout } from './types'

export interface SlotRect {
  x: number
  y: number
  width: number
  height: number
}

export function getLayoutSlots(layout: BoothLayout, width: number, height: number): SlotRect[] {
  const pad = width * 0.065
  const footer = layout.kind === 'grid' ? height * 0.16 : height * 0.12

  if (layout.kind === 'grid') {
    const gap = width * 0.035
    const cellWidth = (width - pad * 2 - gap) / 2
    const cellHeight = (height - pad * 2 - footer - gap) / 2
    return [
      { x: pad, y: pad, width: cellWidth, height: cellHeight },
      { x: pad + cellWidth + gap, y: pad, width: cellWidth, height: cellHeight },
      { x: pad, y: pad + cellHeight + gap, width: cellWidth, height: cellHeight },
      { x: pad + cellWidth + gap, y: pad + cellHeight + gap, width: cellWidth, height: cellHeight },
    ]
  }

  const gap = width * 0.045
  const slotHeight = (height - pad * 2 - footer - gap * (layout.slots - 1)) / layout.slots
  return Array.from({ length: layout.slots }, (_, index) => ({
    x: pad,
    y: pad + index * (slotHeight + gap),
    width: width - pad * 2,
    height: slotHeight,
  }))
}
