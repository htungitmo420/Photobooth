import type { CollageSettings } from '../collage'
import type { BoothSession } from '../types'
import { composeCollage } from './collage'
import { composeStrip } from './strip'

function flattenForJpeg(rendered: HTMLCanvasElement, format: 'png' | 'jpeg', hasOverlayAsset: boolean): HTMLCanvasElement {
  if (format !== 'jpeg' || !hasOverlayAsset) return rendered
  const flattened = document.createElement('canvas')
  flattened.width = rendered.width
  flattened.height = rendered.height
  const context = flattened.getContext('2d')
  if (!context) return rendered
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, flattened.width, flattened.height)
  context.drawImage(rendered, 0, 0)
  return flattened
}

export async function canvasToBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpeg') {
  const type = format === 'png' ? 'image/png' : 'image/jpeg'
  const quality = format === 'jpeg' ? 0.97 : undefined
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Không thể mã hóa ảnh.')), type, quality)
  })
}

async function downloadCanvas(canvas: HTMLCanvasElement, format: 'png' | 'jpeg', prefix: string) {
  const blob = await canvasToBlob(canvas, format)
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
  anchor.download = `${prefix}-${stamp}.${format === 'png' ? 'png' : 'jpg'}`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function composeStripBlob(session: BoothSession, format: 'png' | 'jpeg' = 'jpeg') {
  const rendered = await composeStrip(session)
  const canvas = flattenForJpeg(rendered, format, Boolean(session.frame.assetUrl))
  return canvasToBlob(canvas, format)
}

export async function downloadStrip(session: BoothSession, format: 'png' | 'jpeg') {
  const rendered = await composeStrip(session)
  const canvas = flattenForJpeg(rendered, format, Boolean(session.frame.assetUrl))
  await downloadCanvas(canvas, format, 'photobooth')
}

export async function downloadCollage(session: BoothSession, settings: CollageSettings, format: 'png' | 'jpeg') {
  const canvas = await composeCollage(session, settings)
  await downloadCanvas(canvas, format, 'photobooth-collage')
}
