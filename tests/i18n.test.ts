import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LOCALE_OPTIONS,
  LOCALE_STORAGE_KEY,
  appendLocaleParam,
  getInitialLocale,
  getIntlLocaleTag,
  getMessages,
  localizeBoothError,
  normalizeLocale,
} from '../src/i18n/core'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear() { store.clear() },
    getItem(key: string) { return store.get(key) ?? null },
    key(index: number) { return Array.from(store.keys())[index] ?? null },
    removeItem(key: string) { store.delete(key) },
    setItem(key: string, value: string) { store.set(key, value) },
  }
}

describe('Photobooth i18n', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supports vi, en, and ru with Vietnamese as default', () => {
    expect(LOCALE_OPTIONS.map((item) => item.code)).toEqual(['vi', 'en', 'ru'])
    expect(normalizeLocale('en-GB')).toBe('en')
    expect(normalizeLocale('ru-RU')).toBe('ru')
    expect(normalizeLocale('de')).toBeNull()
    expect(getInitialLocale('')).toBe('vi')

    localStorage.setItem(LOCALE_STORAGE_KEY, 'ru')
    expect(getInitialLocale('')).toBe('ru')
    expect(getInitialLocale('?lang=en')).toBe('en')
  })

  it('appends ?lang param to LiveGallery share URLs only for non-default locales', () => {
    const base = 'https://photobooth-itmo.vercel.app/i/d44092'
    expect(appendLocaleParam(base, 'vi')).toBe(base)
    expect(appendLocaleParam(base, 'en')).toBe(`${base}?lang=en`)
    expect(appendLocaleParam(base, 'ru')).toBe(`${base}?lang=ru`)
  })

  it('provides complete localized copy and camera/upload error translations', () => {
    for (const { code } of LOCALE_OPTIONS) {
      const msg = getMessages(code)
      expect(msg.setup.startCamera.length).toBeGreaterThan(0)
      expect(msg.layouts.strip4.name.length).toBeGreaterThan(0)
      expect(msg.filters.mono.length).toBeGreaterThan(0)
      expect(msg.modals.openLiveGallery.length).toBeGreaterThan(0)
      expect(getIntlLocaleTag(code)).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
    }

    expect(localizeBoothError('Không tìm thấy camera trên thiết bị này.', 'en')).toBe('No camera found on this device.')
    expect(localizeBoothError('Không tìm thấy camera trên thiết bị này.', 'ru')).toBe('Камера на этом устройстве не найдена.')
    expect(localizeBoothError('Không tìm thấy camera trên thiết bị này.', 'vi')).toBe('Không tìm thấy camera trên thiết bị này.')
  })
})
