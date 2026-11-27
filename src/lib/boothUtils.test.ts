import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clampCountdown,
  createDefaultCollageSettings,
  formatShareHost,
  getSavedCountdown,
  padFrame,
  saveCountdown,
} from './boothUtils'

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

describe('boothUtils', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('formats frame numbers and share hosts safely', () => {
    expect(padFrame(1)).toBe('01')
    expect(padFrame(12)).toBe('12')
    expect(formatShareHost('https://photobooth-itmo.vercel.app/i/abc123')).toBe('photobooth-itmo.vercel.app')
    expect(formatShareHost('not-a-url')).toBe('LiveGallery')
  })

  it('clamps and persists countdown preferences safely', () => {
    expect(clampCountdown(-5)).toBe(0)
    expect(clampCountdown(45)).toBe(30)
    expect(clampCountdown(Number.NaN)).toBe(3)

    expect(getSavedCountdown()).toBe(3)
    saveCountdown(5)
    expect(getSavedCountdown()).toBe(5)

    localStorage.setItem('photobooth-countdown', '999')
    expect(getSavedCountdown()).toBe(30)
  })

  it('creates fresh default collage settings', () => {
    const a = createDefaultCollageSettings()
    const b = createDefaultCollageSettings()
    expect(a).toEqual(b)
    expect(a.items).not.toBe(b.items)
    expect(a.format).toBe('story')
    expect(a.items).toHaveLength(1)
  })
})
