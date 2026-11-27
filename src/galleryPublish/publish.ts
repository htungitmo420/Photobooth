import { runWithConcurrency } from './concurrency'
import { isSafeRemoteUrl, prepareUploadFiles } from './encoding'
import {
  extractValidatedShare,
  publishMultipart,
  putFileWithRetry,
  sendBestEffortAbort,
  validateUploadDescriptors,
} from './transport'
import type {
  GalleryPublishInput,
  GalleryShare,
  InitResponsePayload,
  PublishGalleryOptions,
} from './types'

const DEFAULT_UPLOAD_CONCURRENCY = 5
const DEFAULT_RETRY_DELAY_MS = 250

function getPublishEndpoint(override?: string) {
  const explicit = (override ?? import.meta.env.VITE_GALLERY_PUBLISH_URL)?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/album-publish` : ''
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
