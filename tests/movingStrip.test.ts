import { describe, expect, it } from 'vitest'
import { prepareUploadFiles } from '../src/galleryPublish/encoding'
import { extensionForVideoMime, selectBestVideoMimeType } from '../src/motionCapture'
import {
  DEFAULT_MOVING_STRIP_LOOPS,
  buildBurstTimeline,
  computeMovingStripSize,
  getMovingStripSessionKey,
  hasLiveBurstFrames,
} from '../src/rendering'
import { FALLBACK_FRAMES, LAYOUTS } from '../src/presets'
import type { BoothSession, CapturedPhoto } from '../src/types'

describe('Moving PhotoStrip live burst & HD video pipeline', () => {
  it('detects whether captured photos contain pre-shutter live motion bursts', () => {
    expect(hasLiveBurstFrames([{ id: '1', dataUrl: 'data:image/jpeg;base64,AA==' }])).toBe(false)
    expect(
      hasLiveBurstFrames([
        { id: '1', dataUrl: 'data:image/jpeg;base64,AA==', burstFrames: ['f1'] },
      ]),
    ).toBe(false)
    expect(
      hasLiveBurstFrames([
        { id: '1', dataUrl: 'data:image/jpeg;base64,AA==', burstFrames: ['f1', 'f2'] },
      ]),
    ).toBe(true)
  })

  it('computes even Full HD dimensions within 1080×1920 preserving strip aspect ratio', () => {
    const strip4 = computeMovingStripSize(1060, 2828)
    expect(strip4.width % 2).toBe(0)
    expect(strip4.height % 2).toBe(0)
    expect(strip4.width).toBeLessThanOrEqual(1080)
    expect(strip4.height).toBeLessThanOrEqual(1920)
    expect(strip4.height).toBe(1920)

    const grid4 = computeMovingStripSize(1732, 1732)
    expect(grid4.width).toBe(1080)
    expect(grid4.height).toBe(1080)
  })

  it('synchronizes uneven burst frame counts across all slots and appends a posed freeze hold', () => {
    const photos: CapturedPhoto[] = [
      { id: 'p1', dataUrl: 'still-1', burstFrames: ['b1-0', 'b1-1', 'b1-2'] },
      { id: 'p2', dataUrl: 'still-2', burstFrames: ['b2-0', 'b2-1'] },
      { id: 'p3', dataUrl: 'still-3' },
    ]

    const timeline = buildBurstTimeline(photos, 2)
    expect(timeline).toEqual([
      ['b1-0', 'b2-0', 'still-3'],
      ['b1-1', 'b2-1', 'still-3'],
      ['b1-2', 'b2-1', 'still-3'],
      ['still-1', 'still-2', 'still-3'],
      ['still-1', 'still-2', 'still-3'],
    ])
  })

  it('prefers MP4 H.264 video codecs and falls back to WebM cleanly', () => {
    expect(
      selectBestVideoMimeType((mime) => mime === 'video/mp4;codecs=avc1.42E01E' || mime === 'video/webm;codecs=vp9'),
    ).toBe('video/mp4;codecs=avc1.42E01E')
    expect(
      selectBestVideoMimeType((mime) => mime === 'video/webm;codecs=vp9'),
    ).toBe('video/webm;codecs=vp9')
    expect(extensionForVideoMime('video/mp4;codecs=avc1.42E01E')).toBe('mp4')
    expect(extensionForVideoMime('video/webm;codecs=vp9')).toBe('webm')
  })

  it('prepares strip, moving-strip.mp4, and exact layout photos without any GIF', async () => {
    const files = await prepareUploadFiles(
      {
        title: 'Live Strip Test',
        layoutId: 'strip3',
        selectedPhotoIds: ['p1', 'p2', 'p3'],
        photos: [
          { id: 'p1', dataUrl: 'data:image/jpeg;base64,/9j/4AAQ' },
          { id: 'p2', dataUrl: 'data:image/jpeg;base64,/9j/4AAQ' },
          { id: 'p3', dataUrl: 'data:image/jpeg;base64,/9j/4AAQ' },
        ],
        stripBlob: new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' }),
        motion: {
          videoBlob: new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], { type: 'video/mp4' }),
          videoMimeType: 'video/mp4',
          videoUrl: 'blob:video',
          posterUrl: 'blob:poster',
          durationMs: 4200,
        },
      },
      globalThis.fetch,
    )

    expect(files.map((item) => ({ role: item.role, name: item.name, mimeType: item.mimeType }))).toEqual([
      { role: 'strip', name: 'photobooth.jpg', mimeType: 'image/jpeg' },
      { role: 'video', name: 'moving-strip.mp4', mimeType: 'video/mp4' },
      { role: 'photo', name: 'photo-01.jpg', mimeType: 'image/jpeg' },
      { role: 'photo', name: 'photo-02.jpg', mimeType: 'image/jpeg' },
      { role: 'photo', name: 'photo-03.jpg', mimeType: 'image/jpeg' },
    ])
  })

  it('keeps default loops at 2 and computes deterministic session cache keys for Moving Strip reuse', () => {
    expect(DEFAULT_MOVING_STRIP_LOOPS).toBe(2)

    const baseSession: BoothSession = {
      layout: LAYOUTS[1],
      frame: FALLBACK_FRAMES[0],
      filter: 'original',
      photos: [
        { id: 'p1', dataUrl: 'still-1', burstFrames: ['b1', 'b2'] },
        { id: 'p2', dataUrl: 'still-2', burstFrames: ['b1', 'b2'] },
        { id: 'p3', dataUrl: 'still-3', burstFrames: ['b1', 'b2'] },
        { id: 'p4', dataUrl: 'still-4', burstFrames: ['b1', 'b2'] },
      ],
      caption: 'KHOẢNH KHẮC',
      showDate: true,
      date: new Date('2026-11-27T12:00:00Z'),
      stickers: [],
    }

    const key1 = getMovingStripSessionKey(baseSession)
    expect(key1).toBe(getMovingStripSessionKey({ ...baseSession }))
    expect(getMovingStripSessionKey({ ...baseSession, filter: 'vintage' })).not.toBe(key1)
    expect(getMovingStripSessionKey({ ...baseSession, caption: 'GRADUATION' })).not.toBe(key1)

    const overlaySession: BoothSession = {
      ...baseSession,
      frame: {
        ...FALLBACK_FRAMES[0],
        id: 'kodak-strip4',
        assetUrl: 'https://example.supabase.co/storage/v1/object/public/photobooth-frames/kodak.png',
      },
    }
    const overlayKey = getMovingStripSessionKey(overlaySession)
    // Overlay frames hide the text footer, so caption edits do not invalidate the cached Moving Strip
    expect(getMovingStripSessionKey({ ...overlaySession, caption: 'IGNORED' })).toBe(overlayKey)
  })
})
