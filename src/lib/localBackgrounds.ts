const DATABASE_NAME = 'photobooth-collage-backgrounds'
const STORE_NAME = 'backgrounds'
const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

interface StoredBackground {
  id: string
  name: string
  blob: Blob
  createdAt: number
}

export interface LocalBackground {
  id: string
  name: string
  url: string
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
    request.onerror = () => reject(request.error ?? new Error('Không thể mở bộ nhớ nền ghép.'))
  })
}

async function runStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không thể cập nhật nền ghép cục bộ.'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => reject(transaction.error ?? new Error('Không thể cập nhật nền ghép cục bộ.'))
  })
}

function toBackground(record: StoredBackground): LocalBackground {
  return { id: record.id, name: record.name, url: URL.createObjectURL(record.blob) }
}

function validateImage(file: File) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      if (image.naturalWidth < 320 || image.naturalHeight < 320) {
        reject(new Error('Ảnh nền cần có kích thước ít nhất 320 × 320 px.'))
      } else resolve()
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('File nền không phải ảnh hợp lệ.'))
    }
    image.src = url
  })
}

export async function loadLocalBackgrounds(): Promise<LocalBackground[]> {
  const records = await runStore<StoredBackground[]>('readonly', (store) => store.getAll())
  return records.sort((a, b) => b.createdAt - a.createdAt).map(toBackground)
}

export async function saveLocalBackground(file: File): Promise<LocalBackground> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Nền ghép chỉ nhận file PNG, JPG hoặc WebP.')
  if (file.size > MAX_BACKGROUND_BYTES) throw new Error('Ảnh nền phải nhỏ hơn 8 MB.')
  await validateImage(file)

  const record: StoredBackground = {
    id: `background-${crypto.randomUUID()}`,
    name: file.name.replace(/\.[^.]+$/, '').trim().slice(0, 32) || 'Nền của tôi',
    blob: file,
    createdAt: Date.now(),
  }
  await runStore<IDBValidKey>('readwrite', (store) => store.add(record))
  return toBackground(record)
}

export async function deleteLocalBackground(id: string) {
  await runStore<undefined>('readwrite', (store) => store.delete(id))
}

export function revokeBackgroundUrls(backgrounds: LocalBackground[]) {
  backgrounds.forEach((background) => URL.revokeObjectURL(background.url))
}
