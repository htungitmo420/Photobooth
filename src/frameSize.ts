import type { BoothFrame, BoothLayout } from './types'

// Every frame is rendered with the same pixel budget. Frame artwork keeps its
// original aspect ratio, while low-resolution assets are no longer allowed to
// reduce the quality of the exported photo.
export const FRAME_TARGET_PIXELS = 3_000_000

function even(value: number) {
  const rounded = Math.max(2, Math.round(value))
  return rounded % 2 === 0 ? rounded : rounded + 1
}

export function getFrameSize(layout: BoothLayout, frame: BoothFrame) {
  const sourceWidth = frame.assetUrl && frame.assetWidth && frame.assetWidth > 0
    ? frame.assetWidth
    : layout.width
  const sourceHeight = frame.assetUrl && frame.assetHeight && frame.assetHeight > 0
    ? frame.assetHeight
    : layout.height
  const aspect = sourceWidth / sourceHeight
  const width = even(Math.sqrt(FRAME_TARGET_PIXELS * aspect))
  const height = even(width / aspect)
  return { width, height }
}
