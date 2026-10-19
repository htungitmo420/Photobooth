import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { getSourceCrop, type CameraTransform } from './cameraGeometry'

export const MOTION_DURATION_MS = 6000
const GIF_FRAME_DELAY_MS = 500
const VIDEO_WIDTH = 720
const VIDEO_HEIGHT = 540
const GIF_WIDTH = 720
const GIF_HEIGHT = 540

export type CaptureMode = 'photo' | 'photo-gallery'

export interface MotionClip {
  videoBlob: Blob | null
  gifBlob: Blob
  videoUrl: string | null
  gifUrl: string
  durationMs: number
}

export const PHOTO_FRAME_DELAY_MS = 750

export function getPhotoFrameDelay(photoCount: number) {
  if (!Number.isInteger(photoCount) || photoCount <= 0) {
    throw new Error('Cần ít nhất một ảnh để tạo chuyển động.')
  }
  return PHOTO_FRAME_DELAY_MS
}

export function getPhotoMotionDuration(photoCount: number) {
  return getPhotoFrameDelay(photoCount) * photoCount
}

function loadPhoto(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Không thể đọc ảnh để tạo chuyển động.'))
    image.src = source
  })
}

function drawPhotoCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.clearRect(0, 0, width, height)
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

export async function createPhotoMotionClip(sources: string[]): Promise<MotionClip> {
  if (sources.length === 0) throw new Error('Cần ít nhất một ảnh để tạo chuyển động.')
  const images = await Promise.all(sources.map(loadPhoto))
  const gifCanvas = document.createElement('canvas')
  gifCanvas.width = GIF_WIDTH
  gifCanvas.height = GIF_HEIGHT
  const gifContext = gifCanvas.getContext('2d', { willReadFrequently: true })
  if (!gifContext) throw new Error('Không thể chuẩn bị ảnh GIF.')
  const frameDelayMs = getPhotoFrameDelay(images.length)

  const gifFrames = images.map((image) => {
    drawPhotoCover(gifContext, image, GIF_WIDTH, GIF_HEIGHT)
    return gifContext.getImageData(0, 0, GIF_WIDTH, GIF_HEIGHT)
  })
  const gifBlob = encodeGifFrames(gifFrames, frameDelayMs)

  let videoBlob: Blob | null = null
  if (typeof MediaRecorder !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = VIDEO_WIDTH
    canvas.height = VIDEO_HEIGHT
    const context = canvas.getContext('2d')
    if (context && typeof canvas.captureStream === 'function') {
      const stream = canvas.captureStream(12)
      const mimeType = selectRecorderMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined)
      const chunks: BlobPart[] = []
      const stopped = new Promise<void>((resolve, reject) => {
        recorder.addEventListener('dataavailable', (event) => { if (event.data.size > 0) chunks.push(event.data) })
        recorder.addEventListener('stop', () => resolve(), { once: true })
        recorder.addEventListener('error', () => reject(new Error('Không thể tạo video từ các ảnh.')), { once: true })
      })
      recorder.start(200)
      for (const image of images) {
        drawPhotoCover(context, image, VIDEO_WIDTH, VIDEO_HEIGHT)
        await new Promise<void>((resolve) => window.setTimeout(resolve, frameDelayMs))
      }
      recorder.stop()
      await stopped
      stream.getTracks().forEach((track) => track.stop())
      const encoded = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
      if (encoded.size > 0) videoBlob = encoded
    }
  }

  return {
    videoBlob,
    gifBlob,
    videoUrl: videoBlob ? URL.createObjectURL(videoBlob) : null,
    gifUrl: URL.createObjectURL(gifBlob),
    durationMs: getPhotoMotionDuration(images.length),
  }
}

interface MotionCaptureOptions {
  video: HTMLVideoElement
  mirror: boolean
  transform: CameraTransform
  durationMs?: number
  isPaused: () => boolean
  isCancelled: () => boolean
  onProgress?: (remainingMs: number) => void
  onEncoding?: () => void
}

export function selectRecorderMimeType(isSupported: (mimeType: string) => boolean) {
  return [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find(isSupported) ?? ''
}

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function drawVideoFrame(
  video: HTMLVideoElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  mirror: boolean,
  transform: CameraTransform,
) {
  const crop = getSourceCrop(video.videoWidth, video.videoHeight, 4 / 3, transform)
  context.save()
  context.clearRect(0, 0, width, height)
  if (mirror) {
    context.translate(width, 0)
    context.scale(-1, 1)
  }
  context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
  context.restore()
}

export function encodeGifFrames(frames: ImageData[], delay: number) {
  if (frames.length === 0) throw new Error('Không thu được khung hình để tạo GIF.')
  const gif = GIFEncoder()
  frames.forEach((frame) => {
    const palette = quantize(frame.data, 256)
    const indexed = applyPalette(frame.data, palette)
    gif.writeFrame(indexed, frame.width, frame.height, { palette, delay, repeat: 0 })
  })
  gif.finish()
  const encoded = gif.bytes()
  const bytes = new Uint8Array(encoded.byteLength)
  bytes.set(encoded)
  return new Blob([bytes.buffer], { type: 'image/gif' })
}

export async function captureMotionClip(options: MotionCaptureOptions): Promise<MotionClip> {
  if (typeof MediaRecorder === 'undefined') throw new Error('Trình duyệt này chưa hỗ trợ quay video.')
  if (!options.video.videoWidth || options.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error('Camera chưa sẵn sàng để quay chuyển động.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_WIDTH
  canvas.height = VIDEO_HEIGHT
  const context = canvas.getContext('2d')
  if (!context || typeof canvas.captureStream !== 'function') {
    throw new Error('Trình duyệt này chưa hỗ trợ quay khung camera.')
  }

  const gifCanvas = document.createElement('canvas')
  gifCanvas.width = GIF_WIDTH
  gifCanvas.height = GIF_HEIGHT
  const gifContext = gifCanvas.getContext('2d', { willReadFrequently: true })
  if (!gifContext) throw new Error('Không thể chuẩn bị ảnh GIF.')

  drawVideoFrame(options.video, context, VIDEO_WIDTH, VIDEO_HEIGHT, options.mirror, options.transform)
  const stream = canvas.captureStream(24)
  const mimeType = selectRecorderMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder))
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 3_500_000 } : undefined)
  const chunks: BlobPart[] = []
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size > 0) chunks.push(event.data) })
    recorder.addEventListener('stop', () => resolve(), { once: true })
    recorder.addEventListener('error', () => reject(new Error('Không thể ghi đoạn video.')), { once: true })
  })

  const durationMs = options.durationMs ?? MOTION_DURATION_MS
  const gifFrames: ImageData[] = []
  const targetGifFrames = Math.max(1, Math.ceil(durationMs / GIF_FRAME_DELAY_MS))
  let nextGifFrameAt = 0
  let elapsed = 0
  let lastTick = performance.now()
  let recorderPaused = false
  let cancelled = false

  recorder.start(250)
  try {
    while (elapsed < durationMs) {
      if (options.isCancelled()) {
        cancelled = true
        break
      }

      const now = performance.now()
      if (options.isPaused()) {
        if (!recorderPaused && recorder.state === 'recording') {
          recorder.pause()
          recorderPaused = true
        }
        lastTick = now
        await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
        continue
      }

      if (recorderPaused && recorder.state === 'paused') {
        recorder.resume()
        recorderPaused = false
      }
      elapsed = Math.min(durationMs, elapsed + Math.max(0, now - lastTick))
      lastTick = now
      drawVideoFrame(options.video, context, VIDEO_WIDTH, VIDEO_HEIGHT, options.mirror, options.transform)

      if (elapsed >= nextGifFrameAt && gifFrames.length < targetGifFrames) {
        gifContext.drawImage(canvas, 0, 0, GIF_WIDTH, GIF_HEIGHT)
        gifFrames.push(gifContext.getImageData(0, 0, GIF_WIDTH, GIF_HEIGHT))
        nextGifFrameAt += GIF_FRAME_DELAY_MS
      }
      options.onProgress?.(Math.max(0, durationMs - elapsed))
      await nextPaint()
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop()
    await stopped.catch(() => undefined)
    stream.getTracks().forEach((track) => track.stop())
  }

  if (cancelled) throw new DOMException('Đã hủy quay chuyển động.', 'AbortError')
  const videoBlob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
  if (videoBlob.size === 0) throw new Error('Không thu được dữ liệu video.')
  options.onEncoding?.()
  await nextPaint()
  const gifBlob = encodeGifFrames(gifFrames, GIF_FRAME_DELAY_MS)
  return {
    videoBlob,
    gifBlob,
    videoUrl: URL.createObjectURL(videoBlob),
    gifUrl: URL.createObjectURL(gifBlob),
    durationMs,
  }
}

export function revokeMotionClip(clip: MotionClip | null) {
  if (!clip) return
  if (clip.videoUrl) URL.revokeObjectURL(clip.videoUrl)
  URL.revokeObjectURL(clip.gifUrl)
}

export function downloadMotionBlob(blob: Blob, extension: 'webm' | 'gif') {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `khoanh-khac-${Date.now()}.${extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
