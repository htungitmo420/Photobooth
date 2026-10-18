import type { LayoutId, CapturedPhoto } from './types'
import type { MotionClip } from './motionCapture'

export interface GalleryPublishInput {
  title: string
  message?: string
  layoutId: LayoutId
  selectedPhotoIds: string[]
  photos: CapturedPhoto[]
  stripBlob: Blob
  motion: MotionClip
}

export interface GalleryShare {
  shareCode: string
  url: string
}

function getPublishEndpoint() {
  const explicit = import.meta.env.VITE_GALLERY_PUBLISH_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/album-publish` : ''
}

function extensionFor(type: string) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

async function photoFile(photo: CapturedPhoto, index: number) {
  const response = await fetch(photo.dataUrl)
  const blob = await response.blob()
  return new File([blob], `photo-${String(index + 1).padStart(2, '0')}.${extensionFor(blob.type)}`, {
    type: blob.type || 'image/jpeg',
  })
}

export async function publishGalleryAlbum(input: GalleryPublishInput): Promise<GalleryShare> {
  const endpoint = getPublishEndpoint()
  if (!endpoint) throw new Error('Chưa cấu hình máy chủ LiveGallery.')

  const body = new FormData()
  body.set('title', input.title.trim() || 'Khoảnh khắc của bạn')
  body.set('message', input.message?.trim() ?? '')
  body.set('layoutId', input.layoutId)
  body.set('selectedPhotoIds', JSON.stringify(input.selectedPhotoIds))
  body.set('strip', new File([input.stripBlob], 'photobooth.jpg', { type: input.stripBlob.type || 'image/jpeg' }))
  body.set('loopGif', new File([input.motion.gifBlob], 'khoanh-khac.gif', { type: 'image/gif' }))
  const files = await Promise.all(input.photos.map(photoFile))
  files.forEach((file) => body.append('photos', file))

  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-photobooth-client': 'web-v1',
      ...(publishableKey ? { apikey: publishableKey } : {}),
    },
    body,
  })
  const payload = await response.json().catch(() => ({})) as Partial<GalleryShare> & { error?: string }
  if (!response.ok || !payload.shareCode || !payload.url) {
    throw new Error(payload.error || 'Không thể tạo album LiveGallery.')
  }
  return { shareCode: payload.shareCode, url: payload.url }
}
