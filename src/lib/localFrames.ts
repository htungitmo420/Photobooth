import { detectTransparentSlots, slotsMatchLayout } from '../frameGeometry'
import type { BoothFrame, BoothLayout, FrameConfig, LayoutId } from '../types'

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
  assetWidth?: number
  assetHeight?: number
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
    assetWidth: record.assetWidth,
    assetHeight: record.assetHeight,
  }
}

export async function loadLocalFrames(): Promise<BoothFrame[]> {
  const records = await runStore<StoredFrame[]>('readonly', (store) => store.getAll())
  return records.sort((a, b) => b.createdAt - a.createdAt).map(toFrame)
}

function inspectFrame(file: File, layout: BoothLayout): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      try {
        const ratio = Math.min(1, 420 / Math.max(image.naturalWidth, image.naturalHeight))
        const width = Math.max(1, Math.round(image.naturalWidth * ratio))
        const height = Math.max(1, Math.round(image.naturalHeight * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Không thể kiểm tra frame.')
        context.drawImage(image, 0, 0, width, height)
        const slots = detectTransparentSlots(context.getImageData(0, 0, width, height).data, width, height, layout.slots)
        if (!slotsMatchLayout(slots, layout)) throw new Error(`Frame cần có ${layout.slots} ô ảnh trong suốt đúng bố cục ${layout.name}.`)
        resolve({ width: image.naturalWidth, height: image.naturalHeight })
      } catch (error) {
        reject(error)
      }
      URL.revokeObjectURL(url)
    }
    image.onerror = () => {
      reject(new Error('File frame không phải ảnh hợp lệ.'))
      URL.revokeObjectURL(url)
    }
    image.src = url
  })
}

export async function saveLocalFrame(file: File, name: string, layout: BoothLayout): Promise<BoothFrame> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Frame chỉ nhận file PNG hoặc WebP.')
  if (file.size > MAX_FRAME_BYTES) throw new Error('Frame phải nhỏ hơn 5 MB.')
  const dimensions = await inspectFrame(file, layout)

  const record: StoredFrame = {
    id: `local-${crypto.randomUUID()}`,
    name: name.trim().slice(0, 32) || file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Frame của tôi',
    description: `Frame cá nhân cho ${layout.name}`,
    layoutId: layout.id,
    config: { background: '#fffdf8', accent: '#e85d44', textColor: '#25221f', radius: 24 },
    blob: file,
    assetWidth: dimensions.width,
    assetHeight: dimensions.height,
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
