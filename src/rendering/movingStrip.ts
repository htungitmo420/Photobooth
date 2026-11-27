import { detectTransparentSlots, slotsMatchLayout } from '../frameGeometry'
import { getFrameSize } from '../frameSize'
import { getLayoutSlots, type SlotRect } from '../layoutGeometry'
import {
  MOTION_BURST_FPS,
  MOTION_HOLD_FRAMES,
  selectBestVideoMimeType,
  type MotionClip,
} from '../motionCapture'
import { FILTERS } from '../presets'
import type { BoothSession, CapturedPhoto, FilterId } from '../types'
import { loadImage } from './strip'

export interface MovingStripOptions {
  loops?: number
  fps?: number
  holdFrames?: number
  maxVideoWidth?: number
  maxVideoHeight?: number
  videoBitsPerSecond?: number
  signal?: AbortSignal
}

export const DEFAULT_MOVING_STRIP_LOOPS = 2
const DEFAULT_MAX_VIDEO_WIDTH = 1080
const DEFAULT_MAX_VIDEO_HEIGHT = 1920
const DEFAULT_VIDEO_BITRATE = 5_500_000

/**
 * Computes a deterministic cache key for a session's Moving PhotoStrip output.
 * Reusing the clip when this key matches eliminates ~5s of redundant re-encoding on QR publish.
 */
export function getMovingStripSessionKey(session: BoothSession): string {
  const photoKey = session.photos
    .slice(0, session.layout.slots)
    .map((photo) => `${photo.id}:${photo.burstFrames?.length ?? 0}`)
    .join(',')
  const stickerKey = session.stickers
    .map((sticker) =>
      `${sticker.id}:${sticker.x.toFixed(3)}:${sticker.y.toFixed(3)}:${sticker.size.toFixed(3)}:${sticker.rotation}:${sticker.flipX ? 1 : 0}:${sticker.zIndex}`,
    )
    .join(',')
  const captionKey = session.frame.assetUrl
    ? ''
    : `${session.caption.trim()}|${session.showDate ? 1 : 0}|${session.date.toDateString()}`

  return [
    session.layout.id,
    session.frame.id,
    session.frame.assetUrl ?? '',
    session.filter,
    photoKey,
    captionKey,
    stickerKey,
  ].join('::')
}

function even(value: number): number {
  const rounded = Math.max(2, Math.round(value))
  return rounded % 2 === 0 ? rounded : rounded + 1
}

/**
 * Fits the strip aspect ratio inside Full HD bounds (1080×1920) with even pixel
 * dimensions so H.264 / MP4 hardware encoders produce sharp video across all devices.
 */
export function computeMovingStripSize(
  baseWidth: number,
  baseHeight: number,
  maxWidth = DEFAULT_MAX_VIDEO_WIDTH,
  maxHeight = DEFAULT_MAX_VIDEO_HEIGHT,
): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxWidth / Math.max(1, baseWidth), maxHeight / Math.max(1, baseHeight))
  return {
    width: even(baseWidth * scale),
    height: even(baseHeight * scale),
    scale,
  }
}

export function hasLiveBurstFrames(photos: readonly CapturedPhoto[]): boolean {
  return photos.some((photo) => Array.isArray(photo.burstFrames) && photo.burstFrames.length >= 2)
}

/**
 * Builds synchronized per-tick photo URLs across all strip slots:
 * plays each slot's ~1.6s behind-the-scenes motion simultaneously, then holds
 * briefly on the final posed snapshot (Life4Cuts / Photoism style).
 */
export function buildBurstTimeline(
  photos: readonly CapturedPhoto[],
  holdFrames = MOTION_HOLD_FRAMES,
): string[][] {
  if (photos.length === 0) return []
  const maxBurst = photos.reduce(
    (highest, photo) => Math.max(highest, photo.burstFrames?.length ?? 0),
    0,
  )
  const timeline: string[][] = []

  for (let tick = 0; tick < maxBurst; tick += 1) {
    timeline.push(
      photos.map((photo) => {
        const burst = photo.burstFrames
        if (!burst || burst.length === 0) return photo.dataUrl
        return burst[Math.min(tick, burst.length - 1)]
      }),
    )
  }

  const finalFrame = photos.map((photo) => photo.dataUrl)
  const holdCount = maxBurst > 0 ? Math.max(1, holdFrames) : 1
  for (let h = 0; h < holdCount; h += 1) {
    timeline.push(finalFrame)
  }
  return timeline
}

function paintBackground(context: CanvasRenderingContext2D, width: number, height: number, value: string) {
  if (value.startsWith('linear-gradient')) {
    const colors = value.match(/#[a-fA-F0-9]{6}/g) ?? ['#ffffff', '#f5f5f5']
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, colors[0])
    gradient.addColorStop(1, colors[1] ?? colors[0])
    context.fillStyle = gradient
  } else {
    context.fillStyle = value
  }
  context.fillRect(0, 0, width, height)
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  slot: SlotRect,
  radius: number,
  filterCss: string,
) {
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  if (!naturalWidth || !naturalHeight) return
  const scale = Math.max(slot.width / naturalWidth, slot.height / naturalHeight)
  const drawWidth = naturalWidth * scale
  const drawHeight = naturalHeight * scale
  const drawX = slot.x + (slot.width - drawWidth) / 2
  const drawY = slot.y + (slot.height - drawHeight) / 2

  context.save()
  context.beginPath()
  if (typeof context.roundRect === 'function') {
    context.roundRect(slot.x, slot.y, slot.width, slot.height, radius)
  } else {
    context.rect(slot.x, slot.y, slot.width, slot.height)
  }
  context.clip()
  context.filter = filterCss
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  context.filter = 'none'
  context.restore()
}

function resolveOverlaySlots(
  overlay: HTMLImageElement,
  session: BoothSession,
  width: number,
  height: number,
): SlotRect[] {
  const ratio = Math.min(1, 420 / Math.max(overlay.naturalWidth || 1, overlay.naturalHeight || 1))
  const probeWidth = Math.max(1, Math.round((overlay.naturalWidth || width) * ratio))
  const probeHeight = Math.max(1, Math.round((overlay.naturalHeight || height) * ratio))
  const probe = document.createElement('canvas')
  probe.width = probeWidth
  probe.height = probeHeight
  const ctx = probe.getContext('2d', { willReadFrequently: true })
  if (!ctx) return getLayoutSlots(session.layout, width, height)
  ctx.drawImage(overlay, 0, 0, probeWidth, probeHeight)
  try {
    const detected = detectTransparentSlots(
      ctx.getImageData(0, 0, probeWidth, probeHeight).data,
      probeWidth,
      probeHeight,
      session.layout.slots,
    )
    if (detected.length === session.layout.slots && slotsMatchLayout(detected, session.layout)) {
      return detected.map((slot) => ({
        x: (slot.x / probeWidth) * width,
        y: (slot.y / probeHeight) * height,
        width: (slot.width / probeWidth) * width,
        height: (slot.height / probeHeight) * height,
      }))
    }
  } catch {
    /* Fall back to layout geometry if frame image cannot be probed. */
  }
  return getLayoutSlots(session.layout, width, height)
}

function drawStaticDecorLayer(
  context: CanvasRenderingContext2D,
  session: BoothSession,
  overlay: HTMLImageElement | null,
  stickerImages: Array<HTMLImageElement | null>,
  width: number,
  height: number,
) {
  if (overlay) {
    context.drawImage(overlay, 0, 0, width, height)
  } else {
    context.fillStyle = session.frame.config.textColor
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const captionSize = Math.max(18, width * 0.044)
    context.font = `700 ${captionSize}px system-ui, sans-serif`
    const footerY = height - height * (session.layout.kind === 'grid' ? 0.085 : 0.065)
    const caption = session.caption.trim() || 'KHOẢNH KHẮC'
    context.fillText(
      caption.slice(0, 60),
      width / 2,
      footerY - (session.showDate ? captionSize * 0.45 : 0),
      width * 0.82,
    )

    if (session.showDate) {
      context.globalAlpha = 0.72
      context.font = `500 ${Math.max(14, width * 0.022)}px system-ui, sans-serif`
      context.fillText(
        new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(session.date),
        width / 2,
        footerY + captionSize * 0.62,
      )
      context.globalAlpha = 1
    }
  }

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  session.stickers
    .map((sticker, index) => ({ sticker, image: stickerImages[index] }))
    .sort((a, b) => a.sticker.zIndex - b.sticker.zIndex)
    .forEach(({ sticker, image }) => {
      const size = sticker.size * width
      context.save()
      context.translate(sticker.x * width, sticker.y * height)
      context.rotate((sticker.rotation * Math.PI) / 180)
      context.scale(sticker.flipX ? -1 : 1, 1)
      if (image) {
        context.drawImage(image, -size / 2, -size / 2, size, size)
      } else {
        context.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", system-ui, sans-serif`
        context.fillText(sticker.content, 0, 0)
      }
      context.restore()
    })
}

function getFilterCss(filter: FilterId): string {
  return FILTERS.find((item) => item.id === filter)?.css ?? 'none'
}

export async function createMovingStripClip(
  session: BoothSession,
  options: MovingStripOptions = {},
): Promise<MotionClip> {
  const activePhotos = session.photos.slice(0, session.layout.slots)
  if (activePhotos.length === 0) {
    throw new Error('Cần ít nhất một ảnh để tạo chuyển động.')
  }

  const signal = options.signal
  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new DOMException('Moving strip render aborted.', 'AbortError')
    }
  }
  throwIfAborted()

  const fps = options.fps ?? MOTION_BURST_FPS
  const frameDelayMs = Math.round(1000 / fps)
  const loops = Math.max(1, options.loops ?? DEFAULT_MOVING_STRIP_LOOPS)
  const bitrate = options.videoBitsPerSecond ?? DEFAULT_VIDEO_BITRATE
  const timeline = buildBurstTimeline(activePhotos, options.holdFrames ?? MOTION_HOLD_FRAMES)

  const baseSize = getFrameSize(session.layout, session.frame)
  const { width: videoWidth, height: videoHeight, scale: videoScale } = computeMovingStripSize(
    baseSize.width,
    baseSize.height,
    options.maxVideoWidth ?? DEFAULT_MAX_VIDEO_WIDTH,
    options.maxVideoHeight ?? DEFAULT_MAX_VIDEO_HEIGHT,
  )

  const uniqueUrls = Array.from(new Set(timeline.flat()))
  const [decodedPairs, overlay, stickerImages] = await Promise.all([
    Promise.all(
      uniqueUrls.map(async (url) => {
        try {
          return [url, await loadImage(url)] as const
        } catch {
          return [url, null] as const
        }
      }),
    ),
    session.frame.assetUrl ? loadImage(session.frame.assetUrl).catch(() => null) : Promise.resolve(null),
    Promise.all(
      session.stickers.map(async (sticker) => {
        if (sticker.kind !== 'image') return null
        try {
          return await loadImage(sticker.content)
        } catch {
          return null
        }
      }),
    ),
  ])
  const imageByUrl = new Map<string, HTMLImageElement | null>(decodedPairs)
  throwIfAborted()

  const videoCanvas = document.createElement('canvas')
  videoCanvas.width = videoWidth
  videoCanvas.height = videoHeight
  const videoCtx = videoCanvas.getContext('2d')
  if (!videoCtx) throw new Error('Không thể tạo canvas xuất ảnh.')
  videoCtx.imageSmoothingEnabled = true
  videoCtx.imageSmoothingQuality = 'high'

  const slots = overlay
    ? resolveOverlaySlots(overlay, session, videoWidth, videoHeight)
    : getLayoutSlots(session.layout, videoWidth, videoHeight)

  const decorLayer = document.createElement('canvas')
  decorLayer.width = videoWidth
  decorLayer.height = videoHeight
  const decorCtx = decorLayer.getContext('2d')
  if (decorCtx) {
    decorCtx.imageSmoothingEnabled = true
    decorCtx.imageSmoothingQuality = 'high'
    drawStaticDecorLayer(decorCtx, session, overlay, stickerImages, videoWidth, videoHeight)
  }

  const filterCss = getFilterCss(session.filter)
  const hasOverlay = Boolean(overlay)
  const slotRadius = hasOverlay ? 0 : session.frame.config.radius * videoScale * 0.7
  const borderWidth = Math.max(4, videoWidth * 0.012)

  const paintTick = (urls: readonly string[]) => {
    if (!hasOverlay) {
      paintBackground(videoCtx, videoWidth, videoHeight, session.frame.config.background)
    } else {
      videoCtx.fillStyle = session.frame.config.background || '#ffffff'
      videoCtx.fillRect(0, 0, videoWidth, videoHeight)
    }

    slots.forEach((slot, index) => {
      const image = imageByUrl.get(urls[index])
      if (!hasOverlay) {
        videoCtx.fillStyle = session.frame.config.accent
        videoCtx.beginPath()
        if (typeof videoCtx.roundRect === 'function') {
          videoCtx.roundRect(
            slot.x - borderWidth,
            slot.y - borderWidth,
            slot.width + borderWidth * 2,
            slot.height + borderWidth * 2,
            session.frame.config.radius * videoScale,
          )
        } else {
          videoCtx.rect(
            slot.x - borderWidth,
            slot.y - borderWidth,
            slot.width + borderWidth * 2,
            slot.height + borderWidth * 2,
          )
        }
        videoCtx.fill()
      }
      if (image) {
        drawCover(videoCtx, image, slot, slotRadius, filterCss)
      }
    })

    videoCtx.drawImage(decorLayer, 0, 0)
  }

  // Paint final posed frame first to build crisp poster image
  paintTick(timeline[timeline.length - 1])
  const posterBlob = await new Promise<Blob | null>((resolve) =>
    videoCanvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92),
  )
  const posterUrl = posterBlob ? URL.createObjectURL(posterBlob) : activePhotos[0].dataUrl

  let videoBlob: Blob | null = null
  let videoMimeType: string | undefined
  const canRecordVideo =
    typeof MediaRecorder !== 'undefined' && typeof videoCanvas.captureStream === 'function'

  if (canRecordVideo) {
    const chosenMime = selectBestVideoMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder))
    const stream = videoCanvas.captureStream(Math.max(30, fps * 2))
    let recorder: MediaRecorder | null = null
    try {
      recorder = new MediaRecorder(
        stream,
        chosenMime
          ? { mimeType: chosenMime, videoBitsPerSecond: bitrate }
          : { videoBitsPerSecond: bitrate },
      )
    } catch {
      recorder = null
    }

    if (recorder) {
      const chunks: BlobPart[] = []
      const stopped = new Promise<void>((resolve) => {
        recorder!.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        })
        recorder!.addEventListener('stop', () => resolve(), { once: true })
        recorder!.addEventListener('error', () => resolve(), { once: true })
      })

      paintTick(timeline[0])
      recorder.start(200)

      let abortedDuringLoop = false
      for (let loop = 0; loop < loops && !abortedDuringLoop; loop += 1) {
        for (let tick = 0; tick < timeline.length; tick += 1) {
          if (signal?.aborted) {
            abortedDuringLoop = true
            break
          }
          paintTick(timeline[tick])
          await new Promise<void>((resolve) => window.setTimeout(resolve, frameDelayMs))
        }
      }

      if (recorder.state !== 'inactive') recorder.stop()
      await stopped
      stream.getTracks().forEach((track) => track.stop())

      if (abortedDuringLoop || signal?.aborted) {
        if (posterUrl.startsWith('blob:')) URL.revokeObjectURL(posterUrl)
        throw new DOMException('Moving strip render aborted.', 'AbortError')
      }

      const resolvedMime = (recorder.mimeType || chosenMime || 'video/mp4').split(';', 1)[0].trim().toLowerCase()
      const candidateBlob = new Blob(chunks, { type: resolvedMime })
      if (candidateBlob.size > 0) {
        videoBlob = candidateBlob
        videoMimeType = resolvedMime
      }
    } else {
      stream.getTracks().forEach((track) => track.stop())
    }
  }

  const durationMs = timeline.length * frameDelayMs * loops

  return {
    videoBlob,
    videoMimeType,
    videoUrl: videoBlob ? URL.createObjectURL(videoBlob) : null,
    posterUrl,
    durationMs,
  }
}
