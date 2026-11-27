import type { LayoutId } from '../types'
import { delay } from './concurrency'
import { isSafeRemoteUrl } from './encoding'
import type { GalleryShare, InitUploadDescriptor, PreparedUploadFile } from './types'

const MAX_PUT_ATTEMPTS = 2

function isTransientPutStatus(status: number) {
  return status >= 500 || status === 408 || status === 429
}

export async function putFileWithRetry(
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

export function validateUploadDescriptors(
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

export function extractValidatedShare(payload: Partial<GalleryShare> & { error?: string }): GalleryShare {
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

export async function sendBestEffortAbort(params: {
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

export async function publishMultipart(params: {
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
