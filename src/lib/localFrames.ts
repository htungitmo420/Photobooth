import type { BoothFrame, FrameConfig, LayoutId } from '../types'

const DATABASE_NAME = 'photobooth-local-assets'
const STORE_NAME = 'frames'
const MAX_FRAME_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/webp'])

interface StoredFrame {
  id: string
  name: string
  description: string
  layoutId: LayoutId
  config: FrameConfig
  blob: Blob
  createdAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không thể mở bộ nhớ frame.'))
  })
}

async function runStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không thể cập nhật frame cục bộ.'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => reject(transaction.error ?? new Error('Không thể cập nhật frame cục bộ.'))
  })
}

function toFrame(record: StoredFrame): BoothFrame {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    config: record.config,
    assetUrl: URL.createObjectURL(record.blob),
    source: 'local',
    layoutId: record.layoutId,
  }
}

export async function loadLocalFrames(): Promise<BoothFrame[]> {
  const records = await runStore<StoredFrame[]>('readonly', (store) => store.getAll())
  return records.sort((a, b) => b.createdAt - a.createdAt).map(toFrame)
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(url)
    }
    image.onerror = () => {
      reject(new Error('File frame không phải ảnh hợp lệ.'))
      URL.revokeObjectURL(url)
    }
    image.src = url
  })
}

export async function saveLocalFrame(file: File, name: string, layoutId: LayoutId, expectedAspect: number): Promise<BoothFrame> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Frame chỉ nhận file PNG hoặc WebP.')
  if (file.size > MAX_FRAME_BYTES) throw new Error('Frame phải nhỏ hơn 5 MB.')
  const dimensions = await readImageSize(file)
  const difference = Math.abs(dimensions.width / dimensions.height - expectedAspect) / expectedAspect
  if (difference > 0.04) throw new Error('Tỷ lệ frame chưa khớp bố cục đang chọn. Hãy xuất frame đúng tỷ lệ rồi thử lại.')

  const record: StoredFrame = {
    id: `local-${crypto.randomUUID()}`,
    name: name.trim().slice(0, 32) || file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Frame của tôi',
    description: `Frame cá nhân cho ${layoutId}`,
    layoutId,
    config: { background: '#fffdf8', accent: '#e85d44', textColor: '#25221f', radius: 24 },
    blob: file,
    createdAt: Date.now(),
  }
  await runStore<IDBValidKey>('readwrite', (store) => store.add(record))
  return toFrame(record)
}

export async function deleteLocalFrame(id: string) {
  await runStore<undefined>('readwrite', (store) => store.delete(id))
}

export function revokeFrameUrls(frames: BoothFrame[]) {
  frames.forEach((frame) => {
    if (frame.source === 'local' && frame.assetUrl?.startsWith('blob:')) URL.revokeObjectURL(frame.assetUrl)
  })
}
