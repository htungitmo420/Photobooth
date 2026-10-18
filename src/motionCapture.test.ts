import { describe, expect, it } from 'vitest'
import {
  PHOTO_FRAME_DELAY_MS,
  encodeGifFrames,
  getPhotoFrameDelay,
  getPhotoMotionDuration,
  selectRecorderMimeType,
} from './motionCapture'

describe('photo motion timing', () => {
  it('shows every captured photo for 0.75 seconds', () => {
    expect(PHOTO_FRAME_DELAY_MS).toBe(750)
    expect(getPhotoFrameDelay(6)).toBe(750)
    expect(getPhotoFrameDelay(8)).toBe(750)
    expect(getPhotoMotionDuration(6)).toBe(4500)
    expect(getPhotoMotionDuration(8)).toBe(6000)
  })

  it('requires at least one captured photo', () => {
    expect(() => getPhotoFrameDelay(0)).toThrow('Cần ít nhất một ảnh')
  })
})

describe('selectRecorderMimeType', () => {
  it('prefers VP9, then VP8, then generic WebM', () => {
    expect(selectRecorderMimeType((type) => type.includes('vp8'))).toBe('video/webm;codecs=vp8')
    expect(selectRecorderMimeType((type) => type === 'video/webm')).toBe('video/webm')
  })

  it('lets MediaRecorder choose when no preferred type is supported', () => {
    expect(selectRecorderMimeType(() => false)).toBe('')
  })
})

describe('encodeGifFrames', () => {
  it('creates a valid animated GIF blob from captured RGBA frames', async () => {
    const first = { data: new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]), width: 2, height: 2 } as ImageData
    const second = { data: new Uint8ClampedArray([
      0, 0, 0, 255, 255, 255, 0, 255,
      255, 0, 255, 255, 0, 255, 255, 255,
    ]), width: 2, height: 2 } as ImageData

    const blob = encodeGifFrames([first, second], 500)
    const signature = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 6))

    expect(blob.type).toBe('image/gif')
    expect(blob.size).toBeGreaterThan(20)
    expect(signature).toBe('GIF89a')
  })
})
