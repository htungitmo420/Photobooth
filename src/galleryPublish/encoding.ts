import type { CapturedPhoto } from '../types'
import type { GalleryPublishInput, PreparedUploadFile } from './types'

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function baseMimeType(raw: string | undefined | null) {
  return (raw ?? '').split(';', 1)[0].trim().toLowerCase()
}

export function normalizeImageMime(raw: string | undefined | null) {
  const normalized = baseMimeType(raw)
  return ALLOWED_IMAGE_MIMES.has(normalized) ? normalized : 'image/jpeg'
}

export function extensionFor(type: string) {
  const normalized = baseMimeType(type)
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/webp') return 'webp'
  return 'jpg'
}

export function isSafeRemoteUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed) return false
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }
  if (parsed.username || parsed.password) return false
  if (parsed.protocol === 'https:') return Boolean(parsed.hostname)
  if (parsed.protocol === 'http:') {
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  }
  return false
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!dataUrl.startsWith('data:')) return null
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return null
  const meta = dataUrl.slice(5, commaIndex)
  const payload = dataUrl.slice(commaIndex + 1)
  const parts = meta.split(';')
  const mimeType = baseMimeType(parts[0]) || 'image/jpeg'
  const isBase64 = parts.some((part) => part.trim().toLowerCase() === 'base64')
  try {
    if (isBase64) {
      const binary = atob(payload)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      return new Blob([bytes], { type: mimeType })
    }
    return new Blob([decodeURIComponent(payload)], { type: mimeType })
  } catch {
    return null
  }
}

async function photoToBlob(photo: CapturedPhoto, fetchFn: typeof fetch): Promise<Blob> {
  if (photo.dataUrl.startsWith('data:')) {
    const decoded = dataUrlToBlob(photo.dataUrl)
    if (!decoded) throw new Error('Không thể đọc dữ liệu ảnh đã chụp.')
    return decoded
  }
  if (!photo.dataUrl.startsWith('blob:') && !isSafeRemoteUrl(photo.dataUrl)) {
    throw new Error('Nguồn dữ liệu ảnh không hợp lệ.')
  }
  const response = await fetchFn(photo.dataUrl)
  if (!response.ok) throw new Error('Không thể đọc dữ liệu ảnh đã chụp.')
  return response.blob()
}

export async function prepareUploadFiles(
  input: GalleryPublishInput,
  fetchFn: typeof fetch,
): Promise<PreparedUploadFile[]> {
  const stripMime = normalizeImageMime(input.stripBlob.type)
  const stripName = `photobooth.${extensionFor(stripMime)}`
  const stripFile = new File([input.stripBlob], stripName, { type: stripMime })

  const gifFile = new File([input.motion.gifBlob], 'photobooth.gif', { type: 'image/gif' })

  const photoFiles = await Promise.all(
    input.photos.map(async (photo, index): Promise<PreparedUploadFile> => {
      const blob = await photoToBlob(photo, fetchFn)
      const mimeType = normalizeImageMime(blob.type)
      const name = `photo-${String(index + 1).padStart(2, '0')}.${extensionFor(mimeType)}`
      return {
        role: 'photo',
        name,
        mimeType,
        file: new File([blob], name, { type: mimeType }),
      }
    }),
  )

  return [
    { role: 'strip', name: stripName, mimeType: stripMime, file: stripFile },
    { role: 'gif', name: 'photobooth.gif', mimeType: 'image/gif', file: gifFile },
    ...photoFiles,
  ]
}
