import {
  DEFAULT_COLLAGE_BACKGROUND,
  createSingleCollageItem,
  type CollageSettings,
} from '../collage'

export const COLLAGE_BACKGROUNDS = ['#5a3822', '#171717', '#f4e7d3', '#d98282', '#6c7c63', '#596b8d', '#f7f2ea']

const COUNTDOWN_STORAGE_KEY = 'photobooth-countdown'

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatShareHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'LiveGallery'
  }
}

export function padFrame(value: number): string {
  return String(value).padStart(2, '0')
}

export function clampCountdown(value: number): number {
  return Number.isFinite(value) ? Math.min(30, Math.max(0, value)) : 3
}

export function getSavedCountdown(): number {
  try {
    const saved = localStorage.getItem(COUNTDOWN_STORAGE_KEY)
    if (saved === null) return 3
    return clampCountdown(Number(saved))
  } catch {
    return 3
  }
}

export function saveCountdown(seconds: number): void {
  try {
    localStorage.setItem(COUNTDOWN_STORAGE_KEY, String(seconds))
  } catch {
    /* Preference storage is optional. */
  }
}

export function playTone(enabled: boolean, frequency = 760): void {
  if (!enabled) return
  try {
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.1, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.12)
  } catch {
    // Sound is optional.
  }
}

export function createDefaultCollageSettings(): CollageSettings {
  return {
    format: 'story',
    background: DEFAULT_COLLAGE_BACKGROUND,
    backgroundImageUrl: undefined,
    pattern: 'solid',
    message: '',
    messageColor: '#ffffff',
    messagePosition: 'bottom',
    items: [createSingleCollageItem('collage-main')],
  }
}
