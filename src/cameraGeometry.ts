export interface CameraTransform {
  zoom: number
  offsetX: number
  offsetY: number
}

export interface SourceCrop {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_CAMERA_TRANSFORM: CameraTransform = { zoom: 1, offsetX: 0, offsetY: 0 }

export function clampCameraTransform(transform: CameraTransform): CameraTransform {
  return {
    zoom: Math.min(3, Math.max(1, transform.zoom)),
    offsetX: Math.min(1, Math.max(-1, transform.offsetX)),
    offsetY: Math.min(1, Math.max(-1, transform.offsetY)),
  }
}

export function getSourceCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
  transform: CameraTransform,
): SourceCrop {
  const safe = clampCameraTransform(transform)
  const sourceAspect = sourceWidth / sourceHeight
  let coverWidth = sourceWidth
  let coverHeight = sourceHeight

  if (sourceAspect > targetAspect) coverWidth = sourceHeight * targetAspect
  else coverHeight = sourceWidth / targetAspect

  const width = coverWidth / safe.zoom
  const height = coverHeight / safe.zoom
  const availableX = sourceWidth - width
  const availableY = sourceHeight - height

  return {
    x: availableX * (safe.offsetX + 1) / 2,
    y: availableY * (safe.offsetY + 1) / 2,
    width,
    height,
  }
}
