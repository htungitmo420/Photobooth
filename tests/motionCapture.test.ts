import { describe, expect, it } from 'vitest'
import {
  MOTION_BURST_DURATION_MS,
  MOTION_BURST_FPS,
  MOTION_BURST_MAX_FRAMES,
  extensionForVideoMime,
  selectBestVideoMimeType,
  selectRecorderMimeType,
} from '../src/motionCapture'

describe('live motion burst configuration', () => {
  it('captures ~1.6s of smooth 15 fps live motion per slot', () => {
    expect(MOTION_BURST_DURATION_MS).toBe(1600)
    expect(MOTION_BURST_FPS).toBe(15)
    expect(MOTION_BURST_MAX_FRAMES).toBe(24)
  })
})

describe('video MIME selection', () => {
  it('prefers MP4 H.264 before WebM for Moving PhotoStrip', () => {
    expect(
      selectBestVideoMimeType((type) => type === 'video/mp4;codecs=avc1.42E01E' || type === 'video/webm;codecs=vp9'),
    ).toBe('video/mp4;codecs=avc1.42E01E')
    expect(selectBestVideoMimeType((type) => type.includes('vp8'))).toBe('video/webm;codecs=vp8')
    expect(selectBestVideoMimeType(() => false)).toBe('')
    expect(extensionForVideoMime('video/mp4;codecs=avc1.42E01E')).toBe('mp4')
    expect(extensionForVideoMime('video/webm;codecs=vp9')).toBe('webm')
  })

  it('keeps WebM recorder fallback selector working', () => {
    expect(selectRecorderMimeType((type) => type.includes('vp8'))).toBe('video/webm;codecs=vp8')
    expect(selectRecorderMimeType((type) => type === 'video/webm')).toBe('video/webm')
    expect(selectRecorderMimeType(() => false)).toBe('')
  })
})
