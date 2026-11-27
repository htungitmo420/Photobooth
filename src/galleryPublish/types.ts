import type { MotionClip } from '../motionCapture'
import type { CapturedPhoto, LayoutId } from '../types'

export interface GalleryPublishInput {
  title: string
  message?: string
  layoutId: LayoutId
  selectedPhotoIds: string[]
  photos: CapturedPhoto[]
  stripBlob: Blob
  motion?: MotionClip | null
}

export interface GalleryShare {
  shareCode: string
  url: string
}

export interface PublishGalleryOptions {
  endpoint?: string
  publishableKey?: string
  fetchFn?: typeof fetch
  concurrency?: number
  retryDelayMs?: number
}

export type UploadFileRole = 'strip' | 'video' | 'photo'

export interface PreparedUploadFile {
  role: UploadFileRole
  name: string
  mimeType: string
  file: File
}

export interface InitUploadDescriptor {
  index: number
  role: UploadFileRole
  name: string
  mimeType: string
  putUrl: string
  storagePath: string
}

export interface InitResponsePayload {
  mode?: string
  albumId?: string
  shareCode?: string
  url?: string
  uploadToken?: string
  uploads?: unknown
  error?: string
}
