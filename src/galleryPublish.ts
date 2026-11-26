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

export interface PublishGalleryOptions {
  endpoint?: string
  publishableKey?: string
  fetchFn?: typeof fetch
  concurrency?: number
  retryDelayMs?: number
}

type UploadFileRole = 'strip' | 'gif' | 'photo'

interface PreparedUploadFile {
  role: UploadFileRole
  name: string
  mimeType: string
  file: File
}

interface InitUploadDescriptor {
  index: number
  role: UploadFileRole
  name: string
  mimeType: string
  putUrl: string
  storagePath: string
}

interface InitResponsePayload {
  mode?: string
  albumId?: string
  shareCode?: string
  url?: string
  uploadToken?: string
  uploads?: unknown
  error?: string
}

const DEFAULT_UPLOAD_CONCURRENCY = 5
const DEFAULT_RETRY_DELAY_MS = 250
const MAX_PUT_ATTEMPTS = 2
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function getPublishEndpoint(override?: string) {
  const explicit = (override ?? import.meta.env.VITE_GALLERY_PUBLISH_URL)?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/album-publish` : ''
}

function baseMimeType(raw: string | undefined | null) {
  return (raw ?? '').split(';', 1)[0].trim().toLowerCase()
}

function normalizeImageMime(raw: string | undefined | null) {
  const normalized = baseMimeType(raw)
  return ALLOWED_IMAGE_MIMES.has(normalized) ? normalized : 'image/jpeg'
}

function extensionFor(type: string) {
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

async function prepareUploadFiles(input: GalleryPublishInput, fetchFn: typeof fetch): Promise<PreparedUploadFile[]> {
  const stripMime = normalizeImageMime(input.stripBlob.type)
  const stripName = `photobooth.${extensionFor(stripMime)}`
  const stripFile = new File([input.stripBlob], stripName, { type: stripMime })

  const gifFile = new File([input.motion.gifBlob], 'khoanh-khac.gif', { type: 'image/gif' })

  const photoFiles = await Promise.all(
    input.photos.map(async (photo, index): Promise<PreparedUploadFile> => {
      const blob = await photoToBlob(photo, fetchFn)
      const mimeType = normalizeImageMime(blob.type)
      const name = `anh-${String(index + 1).padStart(2, '0')}.${extensionFor(mimeType)}`
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
    { role: 'gif', name: 'khoanh-khac.gif', mimeType: 'image/gif', file: gifFile },
    ...photoFiles,
  ]
}

export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const concurrency = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0
  let firstError: unknown = null
  let hasFailed = false

  const runWorker = async () => {
    while (!hasFailed) {
      const currentIndex = nextIndex
      if (currentIndex >= items.length) return
      nextIndex += 1
      try {
        results[currentIndex] = await worker(items[currentIndex], currentIndex)
      } catch (error) {
        if (!hasFailed) {
          hasFailed = true
          firstError = error
        }
        return
      }
    }
  }

  await Promise.allSettled(Array.from({ length: concurrency }, () => runWorker()))
  if (hasFailed) throw firstError
  return results
}

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

function isTransientPutStatus(status: number) {
  return status >= 500 || status === 408 || status === 429
}

async function putFileWithRetry(
  descriptor: InitUploadDescriptor,
  file: File,
  fetchFn: typeof fetch,
  retryDelayMs: number,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_PUT_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchFn(descriptor.putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': descriptor.mimeType },
        body: file,
      })
      if (response.ok) return
      if (!isTransientPutStatus(response.status) || attempt >= MAX_PUT_ATTEMPTS) {
        throw new Error(`Upload failed with status ${response.status}`)
      }
    } catch (error) {
      if (attempt >= MAX_PUT_ATTEMPTS) throw error
      if (error instanceof Error && error.message.startsWith('Upload failed with status ')) {
        throw error
      }
    }
    await delay(retryDelayMs)
  }
}

function validateUploadDescriptors(
  rawUploads: unknown,
  preparedFiles: readonly PreparedUploadFile[],
): InitUploadDescriptor[] | null {
  if (!Array.isArray(rawUploads) || rawUploads.length !== preparedFiles.length) return null
  const seenIndices = new Set<number>()
  const validated: InitUploadDescriptor[] = []

  for (const item of rawUploads) {
    if (!item || typeof item !== 'object') return null
    const candidate = item as Record<string, unknown>
    const index = candidate.index
    const role = candidate.role
    const name = candidate.name
    const mimeType = candidate.mimeType
    const putUrl = candidate.putUrl
    const storagePath = candidate.storagePath

    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= preparedFiles.length) {
      return null
    }
    if (seenIndices.has(index)) return null
    seenIndices.add(index)

    const expectedRole = preparedFiles[index].role
    if (role !== expectedRole) return null
    if (typeof name !== 'string' || !name.trim()) return null
    if (typeof mimeType !== 'string' || !mimeType.trim()) return null
    if (typeof storagePath !== 'string' || !storagePath.trim()) return null
    if (!isSafeRemoteUrl(putUrl)) return null

    validated.push({
      index,
      role: expectedRole,
      name: name.trim(),
      mimeType: mimeType.trim(),
      putUrl: putUrl.trim(),
      storagePath: storagePath.trim(),
    })
  }

  return seenIndices.size === preparedFiles.length ? validated : null
}

function extractValidatedShare(payload: Partial<GalleryShare> & { error?: string }): GalleryShare {
  const shareCode = typeof payload.shareCode === 'string' ? payload.shareCode.trim() : ''
  const rawUrl = typeof payload.url === 'string' ? payload.url.trim() : ''
  if (!shareCode || !rawUrl) {
    throw new Error(payload.error || 'Không thể tạo album LiveGallery.')
  }
  if (!isSafeRemoteUrl(rawUrl)) {
    throw new Error('Liên kết album LiveGallery không hợp lệ.')
  }
  return { shareCode, url: rawUrl }
}

async function sendBestEffortAbort(params: {
  endpoint: string
  jsonHeaders: Record<string, string>
  albumId: string
  uploadToken: string
  storagePaths: string[]
  fetchFn: typeof fetch
}) {
  try {
    await params.fetchFn(params.endpoint, {
      method: 'POST',
      headers: params.jsonHeaders,
      body: JSON.stringify({
        action: 'abort',
        albumId: params.albumId,
        uploadToken: params.uploadToken,
        storagePaths: params.storagePaths,
      }),
    })
  } catch {
    // Abort cleanup is best-effort; never mask the primary upload error.
  }
}

async function publishMultipart(params: {
  endpoint: string
  baseHeaders: Record<string, string>
  title: string
  message: string
  layoutId: LayoutId
  selectedPhotoIds: string[]
  preparedFiles: readonly PreparedUploadFile[]
  fetchFn: typeof fetch
}): Promise<GalleryShare> {
  const [stripEntry, gifEntry, ...photoEntries] = params.preparedFiles
  const body = new FormData()
  body.set('title', params.title)
  body.set('message', params.message)
  body.set('layoutId', params.layoutId)
  body.set('selectedPhotoIds', JSON.stringify(params.selectedPhotoIds))
  body.set('strip', stripEntry.file)
  body.set('loopGif', gifEntry.file)
  photoEntries.forEach((entry) => body.append('photos', entry.file))

  const response = await params.fetchFn(params.endpoint, {
    method: 'POST',
    headers: params.baseHeaders,
    body,
  })
  const payload = await response.json().catch(() => ({})) as Partial<GalleryShare> & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || 'Không thể tạo album LiveGallery.')
  }
  return extractValidatedShare(payload)
}

export async function publishGalleryAlbum(
  input: GalleryPublishInput,
  options: PublishGalleryOptions = {},
): Promise<GalleryShare> {
  const endpoint = getPublishEndpoint(options.endpoint)
  if (!endpoint) throw new Error('Chưa cấu hình máy chủ LiveGallery.')
  if (!isSafeRemoteUrl(endpoint)) throw new Error('Địa chỉ máy chủ LiveGallery không hợp lệ.')

  const fetchFn = options.fetchFn ?? globalThis.fetch
  const concurrency = options.concurrency ?? DEFAULT_UPLOAD_CONCURRENCY
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const publishableKey = (options.publishableKey ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim()

  const title = input.title.trim() || 'Khoảnh khắc của bạn'
  const message = input.message?.trim() ?? ''
  const preparedFiles = await prepareUploadFiles(input, fetchFn)

  const baseHeaders: Record<string, string> = {
    'x-photobooth-client': 'web-v1',
    ...(publishableKey ? { apikey: publishableKey } : {}),
  }
  const jsonHeaders: Record<string, string> = {
    ...baseHeaders,
    'Content-Type': 'application/json',
  }

  const initResponse = await fetchFn(endpoint, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      action: 'init',
      title,
      message,
      layoutId: input.layoutId,
      files: preparedFiles.map((item) => ({
        role: item.role,
        name: item.name,
        mimeType: item.mimeType,
        byteSize: item.file.size,
      })),
    }),
  })

  if (initResponse.status === 400 || initResponse.status === 415) {
    return publishMultipart({
      endpoint,
      baseHeaders,
      title,
      message,
      layoutId: input.layoutId,
      selectedPhotoIds: input.selectedPhotoIds,
      preparedFiles,
      fetchFn,
    })
  }

  const initPayload = await initResponse.json().catch(() => ({})) as InitResponsePayload
  if (!initResponse.ok) {
    throw new Error(initPayload.error || 'Không thể tạo album LiveGallery.')
  }

  if (initPayload.mode === 'multipart') {
    return publishMultipart({
      endpoint,
      baseHeaders,
      title,
      message,
      layoutId: input.layoutId,
      selectedPhotoIds: input.selectedPhotoIds,
      preparedFiles,
      fetchFn,
    })
  }

  if (initPayload.mode !== 'r2-direct') {
    throw new Error(initPayload.error || 'Không thể tạo album LiveGallery.')
  }

  const albumId = typeof initPayload.albumId === 'string' ? initPayload.albumId.trim() : ''
  const uploadToken = typeof initPayload.uploadToken === 'string' ? initPayload.uploadToken.trim() : ''
  const uploads = validateUploadDescriptors(initPayload.uploads, preparedFiles)

  if (!albumId || !uploadToken || !uploads) {
    if (albumId && uploadToken) {
      const fallbackPaths = Array.isArray(initPayload.uploads)
        ? initPayload.uploads
            .map((item) => (item && typeof item === 'object' && typeof (item as { storagePath?: unknown }).storagePath === 'string'
              ? (item as { storagePath: string }).storagePath
              : ''))
            .filter(Boolean)
        : []
      await sendBestEffortAbort({
        endpoint,
        jsonHeaders,
        albumId,
        uploadToken,
        storagePaths: fallbackPaths,
        fetchFn,
      })
    }
    throw new Error('Phản hồi máy chủ lưu trữ không hợp lệ.')
  }

  const storagePaths = uploads.map((item) => item.storagePath)

  try {
    await runWithConcurrency(uploads, concurrency, async (descriptor) => {
      await putFileWithRetry(descriptor, preparedFiles[descriptor.index].file, fetchFn, retryDelayMs)
    })
  } catch {
    await sendBestEffortAbort({
      endpoint,
      jsonHeaders,
      albumId,
      uploadToken,
      storagePaths,
      fetchFn,
    })
    throw new Error('Tải ảnh lên máy chủ lưu trữ thất bại. Hãy thử lại.')
  }

  let completeResponse: Response
  try {
    completeResponse = await fetchFn(endpoint, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        action: 'complete',
        albumId,
        uploadToken,
        files: uploads.map((item) => ({
          index: item.index,
          role: item.role,
          name: item.name,
          mimeType: item.mimeType,
          storagePath: item.storagePath,
        })),
      }),
    })
  } catch {
    await sendBestEffortAbort({
      endpoint,
      jsonHeaders,
      albumId,
      uploadToken,
      storagePaths,
      fetchFn,
    })
    throw new Error('Không thể hoàn tất tạo album LiveGallery. Hãy thử lại.')
  }

  const completePayload = await completeResponse.json().catch(() => ({})) as Partial<GalleryShare> & { error?: string }
  if (!completeResponse.ok) {
    throw new Error(completePayload.error || 'Không thể hoàn tất tạo album LiveGallery.')
  }
  return extractValidatedShare(completePayload)
}
