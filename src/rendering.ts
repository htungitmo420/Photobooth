import { FILTERS } from './presets'
import { getLayoutSlots } from './layoutGeometry'
import { detectTransparentSlots, slotsMatchLayout } from './frameGeometry'
import { getFrameSize } from './frameSize'
import type { BoothSession, FilterId } from './types'

interface FrameAnalysis {
  width: number
  height: number
  slots: ReturnType<typeof getLayoutSlots>
}

const frameAnalysisCache = new Map<string, Promise<FrameAnalysis | null>>()

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = source
  })
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  filter: FilterId,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const drawX = x + (width - drawWidth) / 2
  const drawY = y + (height - drawHeight) / 2

  context.save()
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.clip()
  context.filter = FILTERS.find((item) => item.id === filter)?.css ?? 'none'
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  context.filter = 'none'
  context.restore()
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

async function analyzeFrame(source: string, image: HTMLImageElement, expectedSlots: number) {
  const cached = frameAnalysisCache.get(source)
  if (cached) return cached
  const analysis = Promise.resolve().then(() => {
    const ratio = Math.min(1, 420 / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * ratio))
    const height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, width, height)
    try {
      const slots = detectTransparentSlots(context.getImageData(0, 0, width, height).data, width, height, expectedSlots)
      return slots.length === expectedSlots ? { width, height, slots } : null
    } catch {
      return null
    }
  })
  frameAnalysisCache.set(source, analysis)
  return analysis
}

export async function composeStrip(session: BoothSession, scale = 1) {
  const [images, overlay] = await Promise.all([
    Promise.all(session.photos.map((photo) => loadImage(photo.dataUrl))),
    session.frame.assetUrl ? loadImage(session.frame.assetUrl) : Promise.resolve(null),
  ])
  const dimensions = overlay
    ? { width: overlay.naturalWidth, height: overlay.naturalHeight }
    : getFrameSize(session.layout, session.frame)
  const width = Math.round(dimensions.width * scale)
  const height = Math.round(dimensions.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không thể tạo canvas xuất ảnh.')

  const frameAnalysis = overlay && session.frame.assetUrl
    ? await analyzeFrame(session.frame.assetUrl, overlay, session.layout.slots)
    : null
  if (overlay && (!frameAnalysis || !slotsMatchLayout(frameAnalysis.slots, session.layout))) {
    throw new Error('Frame không có đủ ô ảnh trong suốt đúng bố cục này.')
  }
  const slots = frameAnalysis
    ? frameAnalysis.slots.map((slot) => ({
        x: slot.x / frameAnalysis.width * width,
        y: slot.y / frameAnalysis.height * height,
        width: slot.width / frameAnalysis.width * width,
        height: slot.height / frameAnalysis.height * height,
      }))
    : getLayoutSlots(session.layout, width, height)

  if (!overlay) paintBackground(context, width, height, session.frame.config.background)

  slots.forEach((slot, index) => {
    const image = images[index]
    if (!image) return
    const hasOverlayAsset = Boolean(session.frame.assetUrl)
    if (!hasOverlayAsset) {
      context.fillStyle = session.frame.config.accent
      const border = Math.max(6, width * 0.012)
      context.beginPath()
      context.roundRect(slot.x - border, slot.y - border, slot.width + border * 2, slot.height + border * 2, session.frame.config.radius * scale)
      context.fill()
    }
    drawCover(
      context,
      image,
      slot.x,
      slot.y,
      slot.width,
      slot.height,
      hasOverlayAsset ? 0 : session.frame.config.radius * scale * 0.7,
      session.filter,
    )
  })

  if (overlay) context.drawImage(overlay, 0, 0, width, height)

  if (!overlay) {
    context.fillStyle = session.frame.config.textColor
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const captionSize = Math.max(24, width * 0.044)
    context.font = `700 ${captionSize}px system-ui, sans-serif`
    const footerY = height - height * (session.layout.kind === 'grid' ? 0.085 : 0.065)
    const caption = session.caption.trim() || 'KHOẢNH KHẮC'
    context.fillText(caption.slice(0, 60), width / 2, footerY - (session.showDate ? captionSize * 0.45 : 0), width * 0.82)

    if (session.showDate) {
      context.globalAlpha = 0.72
      context.font = `500 ${Math.max(18, width * 0.022)}px system-ui, sans-serif`
      context.fillText(
        new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(session.date),
        width / 2,
        footerY + captionSize * 0.62,
      )
      context.globalAlpha = 1
    }
  }

  const imageStickers = await Promise.all(session.stickers.map(async (sticker) => {
    if (sticker.kind !== 'image') return null
    try { return await loadImage(sticker.content) } catch { return null }
  }))
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  session.stickers
    .map((sticker, index) => ({ sticker, image: imageStickers[index] }))
    .sort((a, b) => a.sticker.zIndex - b.sticker.zIndex)
    .forEach(({ sticker, image }) => {
      const size = sticker.size * width
      context.save()
      context.translate(sticker.x * width, sticker.y * height)
      context.rotate(sticker.rotation * Math.PI / 180)
      context.scale(sticker.flipX ? -1 : 1, 1)
      if (image) context.drawImage(image, -size / 2, -size / 2, size, size)
      else {
        context.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", system-ui, sans-serif`
        context.fillText(sticker.content, 0, 0)
      }
      context.restore()
    })

  return canvas
}

export async function downloadStrip(session: BoothSession, format: 'png' | 'jpeg') {
  const rendered = await composeStrip(session)
  const canvas = format === 'jpeg' && session.frame.assetUrl
    ? (() => {
        const flattened = document.createElement('canvas')
        flattened.width = rendered.width
        flattened.height = rendered.height
        const context = flattened.getContext('2d')
        if (!context) return rendered
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, flattened.width, flattened.height)
        context.drawImage(rendered, 0, 0)
        return flattened
      })()
    : rendered
  const type = format === 'png' ? 'image/png' : 'image/jpeg'
  const quality = format === 'jpeg' ? 0.92 : undefined
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Không thể mã hóa ảnh.')), type, quality)
  })
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `photobooth-${stamp}.${format === 'png' ? 'png' : 'jpg'}`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
