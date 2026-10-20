import { describe, expect, it } from 'vitest'
import { getCaptureCanvasSize, getHighestCameraConstraints } from './cameraResolution'

describe('camera resolution', () => {
  it('requests the highest resolution reported by the camera', () => {
    expect(getHighestCameraConstraints({ width: { max: 4096 }, height: { max: 2160 } })).toEqual({
      width: { ideal: 4096 },
      height: { ideal: 2160 },
    })
  })

  it('ignores missing or invalid camera capability values', () => {
    expect(getHighestCameraConstraints({ width: { max: 0 } })).toEqual({})
  })

  it('never upscales a camera crop', () => {
    expect(getCaptureCanvasSize(1280, 960)).toEqual({ width: 1280, height: 960 })
  })

  it('keeps the source aspect ratio while limiting very large captures', () => {
    expect(getCaptureCanvasSize(5120, 3840)).toEqual({ width: 3840, height: 2880 })
  })
})
