export const REQUESTED_CAMERA_WIDTH = 3840
export const REQUESTED_CAMERA_HEIGHT = 2160
export const MAX_CAPTURE_WIDTH = 3840

interface CapabilityRange {
  max?: number
}

interface CameraResolutionCapabilities {
  width?: CapabilityRange
  height?: CapabilityRange
}

export function getHighestCameraConstraints(capabilities: CameraResolutionCapabilities): MediaTrackConstraints {
  const width = capabilities.width?.max
  const height = capabilities.height?.max

  return {
    ...(typeof width === 'number' && Number.isFinite(width) && width > 0 ? { width: { ideal: width } } : {}),
    ...(typeof height === 'number' && Number.isFinite(height) && height > 0 ? { height: { ideal: height } } : {}),
  }
}

export function getCaptureCanvasSize(cropWidth: number, cropHeight: number, maxWidth = MAX_CAPTURE_WIDTH) {
  const safeWidth = Math.max(1, cropWidth)
  const safeHeight = Math.max(1, cropHeight)
  const scale = Math.min(1, Math.max(1, maxWidth) / safeWidth)

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  }
}
