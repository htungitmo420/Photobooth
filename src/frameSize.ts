import type { BoothFrame, BoothLayout } from './types'

export function getFrameSize(layout: BoothLayout, frame: BoothFrame) {
  if (frame.assetUrl && frame.assetWidth && frame.assetHeight && frame.assetWidth > 0 && frame.assetHeight > 0) {
    return { width: frame.assetWidth, height: frame.assetHeight }
  }
  return { width: layout.width, height: layout.height }
}
