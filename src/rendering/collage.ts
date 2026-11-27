import { getCollageItemSize, getCollageSize, type CollageSettings } from '../collage'
import type { BoothSession } from '../types'
import { composeStrip, loadImage } from './strip'

function drawCollagePattern(context: CanvasRenderingContext2D, width: number, height: number, settings: CollageSettings) {
  context.fillStyle = 'rgba(255,255,255,.14)'

  if (settings.pattern === 'dots') {
    const gap = Math.max(12, width * 0.018)
    const radius = Math.max(1.5, width * 0.0018)
    for (let y = gap / 2; y < height; y += gap) {
      for (let x = gap / 2; x < width; x += gap) {
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
      }
    }
  }

  if (settings.pattern === 'grid') {
    const gap = Math.max(20, width * 0.026)
    context.strokeStyle = 'rgba(255,255,255,.11)'
    context.lineWidth = Math.max(1, width * 0.001)
    context.beginPath()
    for (let x = 0; x <= width; x += gap) {
      context.moveTo(x, 0)
      context.lineTo(x, height)
    }
    for (let y = 0; y <= height; y += gap) {
      context.moveTo(0, y)
      context.lineTo(width, y)
    }
    context.stroke()
  }
}

function drawCollageMessage(context: CanvasRenderingContext2D, width: number, height: number, settings: CollageSettings) {
  const message = settings.message.trim()
  if (!message) return

  const fontSize = Math.max(24, width * 0.045)
  const maxWidth = width * 0.84
  const words = message.split(/\s+/)
  const lines: string[] = []
  let line = ''

  context.save()
  context.font = `700 ${fontSize}px system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = settings.messageColor
  context.shadowColor = 'rgba(0,0,0,.38)'
  context.shadowBlur = Math.max(4, width * 0.006)
  context.shadowOffsetY = Math.max(2, width * 0.002)

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word
    if (line && context.measureText(candidate).width > maxWidth && lines.length < 2) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  })
  if (line) lines.push(line)

  const lineHeight = fontSize * 1.18
  const blockHeight = lineHeight * lines.length
  const anchorY = settings.messagePosition === 'top' ? height * 0.07 : height * 0.93
  const startY = settings.messagePosition === 'top'
    ? anchorY
    : anchorY - blockHeight + lineHeight

  lines.slice(0, 3).forEach((text, index) => {
    context.fillText(text, width / 2, startY + index * lineHeight, maxWidth)
  })
  context.restore()
}

export async function composeCollage(session: BoothSession, settings: CollageSettings, scale = 1) {
  const strip = await composeStrip(session)
  const output = getCollageSize(settings.format)
  const width = Math.round(output.width * scale)
  const height = Math.round(output.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không thể tạo canvas nền ghép.')

  context.fillStyle = settings.background
  context.fillRect(0, 0, width, height)
  if (settings.backgroundImageUrl) {
    try {
      const background = await loadImage(settings.backgroundImageUrl)
      const backgroundScale = Math.max(width / background.naturalWidth, height / background.naturalHeight)
      const backgroundWidth = background.naturalWidth * backgroundScale
      const backgroundHeight = background.naturalHeight * backgroundScale
      context.drawImage(background, (width - backgroundWidth) / 2, (height - backgroundHeight) / 2, backgroundWidth, backgroundHeight)
    } catch {
      // Keep the selected color as a fallback if a local image is no longer available.
    }
  }
  drawCollagePattern(context, width, height, settings)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  settings.items.slice().sort((a, b) => a.zIndex - b.zIndex).forEach((item) => {
    const size = getCollageItemSize(item, width, strip.width, strip.height)
    context.save()
    context.translate(item.x * width, item.y * height)
    context.rotate(item.rotation * Math.PI / 180)
    context.shadowColor = 'rgba(24,15,10,.24)'
    context.shadowBlur = Math.max(10, width * 0.018)
    context.shadowOffsetY = Math.max(5, width * 0.009)
    context.drawImage(strip, -size.width / 2, -size.height / 2, size.width, size.height)
    context.restore()
  })
  drawCollageMessage(context, width, height, settings)

  return canvas
}
