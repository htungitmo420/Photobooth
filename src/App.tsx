import {
  Camera, Check, ChevronLeft, ChevronRight, Copy, Download, Eye, FlipHorizontal2, Image as ImageIcon,
  Layers, LoaderCircle, Moon, Pause, Play, Plus, RefreshCcw, RotateCcw, RotateCw, ShieldCheck,
  Sun, SwitchCamera, Trash2, Video, Volume2, VolumeX, X, Zap, ZoomIn, ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { DEFAULT_CAMERA_TRANSFORM, type CameraTransform } from './cameraGeometry'
import { suggestedZoomMode, type ZoomMode } from './cameraSource'
import {
  COLLAGE_FORMATS, DEFAULT_COLLAGE_BACKGROUND, MAX_COLLAGE_ITEMS, createSingleCollageItem,
  createTwoStripCollage, getCollageSize, type CollageItem, type CollageSettings,
} from './collage'
import { CollageEditor } from './components/CollageEditor'
import { CollagePreview } from './components/CollagePreview'
import { getFrameSize } from './frameSize'
import { StripPreview } from './components/StripPreview'
import { useCamera } from './hooks/useCamera'
import { loadFrames } from './lib/frames'
import { deleteLocalFrame, loadLocalFrames, revokeFrameUrls, saveLocalFrame } from './lib/localFrames'
import {
  deleteLocalBackground, loadLocalBackgrounds, revokeBackgroundUrls, saveLocalBackground,
  type LocalBackground,
} from './lib/localBackgrounds'
import { loadRemoteBackgrounds, type RemoteBackground } from './lib/backgrounds'
import { loadStickers } from './lib/stickers'
import {
  createPhotoMotionClip, downloadMotionBlob, revokeMotionClip,
  type CaptureMode, type MotionClip,
} from './motionCapture'
import { FILTERS, FALLBACK_FRAMES, FALLBACK_STICKERS, LAYOUTS, STICKER_CATEGORIES } from './presets'
import { composeStripBlob, downloadCollage, downloadStrip } from './rendering'
import { publishGalleryAlbum, type GalleryShare } from './galleryPublish'
import type { AppStep, BoothFrame, BoothSession, BoothSticker, CapturedPhoto, FilterId, FlashMode, StickerAsset, StickerCategory } from './types'

type ThemeMode = 'dark' | 'light'

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

const COLLAGE_BACKGROUNDS = ['#5a3822', '#171717', '#f4e7d3', '#d98282', '#6c7c63', '#596b8d', '#f7f2ea']

const THEME_STORAGE_KEY = 'khoanhkhac-theme'

function getSavedTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function padFrame(value: number) {
  return String(value).padStart(2, '0')
}

function CameraMark({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className="camera-mark" height={size} viewBox="0 0 32 32" width={size}>
      <rect height="20" rx="2" width="26" x="3" y="7" />
      <path d="M10 7 12.5 3.5h7L22 7" />
      <circle cx="16" cy="17" r="5.5" />
      <circle className="camera-mark__lens" cx="16" cy="17" r="2" />
    </svg>
  )
}

function getSavedCountdown() {
  try {
    const saved = localStorage.getItem('photobooth-countdown')
    if (saved === null) return 3
    const value = Number(saved)
    return Number.isFinite(value) ? Math.min(30, Math.max(0, value)) : 3
  } catch {
    return 3
  }
}

function playTone(enabled: boolean, frequency = 760) {
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

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme)
  const [step, setStep] = useState<AppStep>('setup')
  const [layout, setLayout] = useState(LAYOUTS[1])
  const [frames, setFrames] = useState<BoothFrame[]>(FALLBACK_FRAMES)
  const [frame, setFrame] = useState<BoothFrame>(FALLBACK_FRAMES[0])
  const [remoteFrames, setRemoteFrames] = useState(false)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [candidatePhotos, setCandidatePhotos] = useState<CapturedPhoto[]>([])
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo')
  const [motionClip, setMotionClip] = useState<MotionClip | null>(null)
  const [motionPhase, setMotionPhase] = useState<'idle' | 'countdown' | 'recording' | 'encoding'>('idle')
  const [preparingSelection, setPreparingSelection] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(getSavedCountdown)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [paused, setPaused] = useState(false)
  const [mirror, setMirror] = useState(true)
  const [sound, setSound] = useState(false)
  const [screenFlash, setScreenFlash] = useState(false)
  const [flashMode, setFlashMode] = useState<FlashMode>('auto')
  const [cameraTransform, setCameraTransform] = useState<CameraTransform>(DEFAULT_CAMERA_TRANSFORM)
  const [zoomModeOverride, setZoomModeOverride] = useState<ZoomMode | null>(null)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterId>('original')
  const [caption, setCaption] = useState('KHOẢNH KHẮC')
  const [showDate, setShowDate] = useState(true)
  const [stickers, setStickers] = useState<BoothSticker[]>([])
  const [stickerAssets, setStickerAssets] = useState<StickerAsset[]>(FALLBACK_STICKERS)
  const [stickerCategory, setStickerCategory] = useState<'all' | StickerCategory>('all')
  const [editorPanelTab, setEditorPanelTab] = useState<'design' | 'stickers' | 'background'>('design')
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const [collageSettings, setCollageSettings] = useState<CollageSettings>(() => ({
    format: 'story',
    background: DEFAULT_COLLAGE_BACKGROUND,
    pattern: 'solid',
    message: '',
    messageColor: '#ffffff',
    messagePosition: 'bottom',
    items: [createSingleCollageItem('collage-main')],
  }))
  const [selectedCollageItemId, setSelectedCollageItemId] = useState<string | null>('collage-main')
  const [localBackgrounds, setLocalBackgrounds] = useState<LocalBackground[]>([])
  const [remoteBackgrounds, setRemoteBackgrounds] = useState<RemoteBackground[]>([])
  const [remoteBackgroundSource, setRemoteBackgroundSource] = useState(false)
  const [remoteStickers, setRemoteStickers] = useState(false)
  const [sessionDate, setSessionDate] = useState(() => new Date())
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [exporting, setExporting] = useState(false)
  const [notices, setNotices] = useState<Array<{ id: string; message: string }>>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewView, setPreviewView] = useState({ zoom: 1, x: 0, y: 0 })
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState<number | null>(null)
  const [motionPreviewOpen, setMotionPreviewOpen] = useState(false)
  const [publishingGallery, setPublishingGallery] = useState(false)
  const [galleryShare, setGalleryShare] = useState<(GalleryShare & { qrDataUrl: string }) | null>(null)
  const [galleryShareOpen, setGalleryShareOpen] = useState(false)
  const cancelRef = useRef(0)
  const pausedRef = useRef(false)
  const frameInputRef = useRef<HTMLInputElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)
  const previewDragRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const camera = useCamera()
  const cameraLabel = camera.devices.find((device) => device.deviceId === camera.selectedDeviceId)?.label ?? ''
  const zoomMode = zoomModeOverride ?? suggestedZoomMode(cameraLabel)
  const outputSize = editorPanelTab === 'background' ? getCollageSize(collageSettings.format) : getFrameSize(layout, frame)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f3efe6' : '#11100f')
    try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* Theme storage is optional. */ }
  }, [theme])

  const setNotice = useCallback((message: string | null) => {
    if (message === null) {
      setNotices([])
      return
    }
    const id = makeId('notice')
    setNotices((current) => [{ id, message }, ...current].slice(0, 4))
    window.setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), 5500)
  }, [])

  useEffect(() => {
    let disposed = false
    let localFrameUrls: BoothFrame[] = []
    Promise.all([loadFrames(), loadLocalFrames().catch(() => [])]).then(([catalog, local]) => {
      localFrameUrls = local
      if (disposed) return revokeFrameUrls(local)
      const loaded = [...local, ...catalog.frames]
      setFrames(loaded)
      setFrame((current) => loaded.find((candidate) => candidate.id === current.id) ?? loaded[0])
      setRemoteFrames(catalog.remote)
    })
    loadStickers().then((catalog) => {
      if (!disposed) {
        setStickerAssets(catalog.stickers)
        setRemoteStickers(catalog.remote)
      }
    })
    return () => {
      disposed = true
      revokeFrameUrls(localFrameUrls)
    }
  }, [])

  useEffect(() => {
    loadRemoteBackgrounds().then((catalog) => {
      setRemoteBackgrounds(catalog.backgrounds)
      setRemoteBackgroundSource(catalog.remote)
    })
  }, [])

  useEffect(() => {
    let disposed = false
    let loadedBackgrounds: LocalBackground[] = []
    loadLocalBackgrounds().then((backgrounds) => {
      loadedBackgrounds = backgrounds
      if (disposed) revokeBackgroundUrls(backgrounds)
      else setLocalBackgrounds(backgrounds)
    }).catch(() => { /* Local backgrounds are optional. */ })
    return () => {
      disposed = true
      revokeBackgroundUrls(loadedBackgrounds)
    }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('photobooth-countdown', String(countdownSeconds)) } catch { /* Preference storage is optional. */ }
  }, [countdownSeconds])

  useEffect(() => {
    if (camera.facing === 'environment') setMirror(false)
    setCameraTransform(DEFAULT_CAMERA_TRANSFORM)
  }, [camera.facing])

  useEffect(() => {
    document.body.classList.toggle('editor-mode', step === 'edit')
    return () => document.body.classList.remove('editor-mode')
  }, [step])

  useEffect(() => () => revokeMotionClip(motionClip), [motionClip])

  useEffect(() => {
    setGalleryShare(null)
    setGalleryShareOpen(false)
  }, [caption, collageSettings.message, filter, frame.id, photos, stickers])

  useEffect(() => {
    if (!previewOpen && photoPreviewIndex === null && !motionPreviewOpen && !galleryShareOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewOpen(false)
        setPhotoPreviewIndex(null)
        setMotionPreviewOpen(false)
        setGalleryShareOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [galleryShareOpen, motionPreviewOpen, photoPreviewIndex, previewOpen])

  const openPreview = () => {
    setPreviewView({ zoom: 1, x: 0, y: 0 })
    setPreviewOpen(true)
  }

  const setReviewZoom = (zoom: number) => {
    const next = Math.min(4, Math.max(0.75, zoom))
    setPreviewView((current) => ({ ...current, zoom: next }))
  }

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && step === 'capture') {
        cancelRef.current += 1
        setCapturing(false)
        pausedRef.current = false
        setPaused(false)
        setCountdown(null)
        setScreenFlash(false)
        setMotionPhase('idle')
        void camera.setTorch(false)
        camera.stop()
        setNotice('Phiên chụp đã tạm dừng vì bạn chuyển tab.')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [camera, setNotice, step])

  const session: BoothSession = useMemo(() => ({
    layout,
    frame,
    filter,
    photos,
    caption,
    showDate,
    date: sessionDate,
    stickers,
  }), [layout, frame, filter, photos, caption, showDate, sessionDate, stickers])

  const visibleFrames = useMemo(() => frames.filter((item) => !item.layoutId || item.layoutId === layout.id), [frames, layout.id])
  const visibleStickerAssets = useMemo(
    () => stickerAssets.filter((item) => item.category !== 'text' && item.category !== 'shapes' && (stickerCategory === 'all' || item.category === stickerCategory)),
    [stickerAssets, stickerCategory],
  )
  const selectedSticker = stickers.find((item) => item.id === selectedStickerId) ?? null
  const selectedCollageItem = collageSettings.items.find((item) => item.id === selectedCollageItemId) ?? null
  const captureTarget = captureMode === 'photo-gallery' ? layout.slots * 2 : layout.slots
  const capturePool = captureMode === 'photo-gallery' ? candidatePhotos : photos

  useEffect(() => {
    if (frame.layoutId && frame.layoutId !== layout.id) setFrame(FALLBACK_FRAMES[0])
  }, [frame, layout.id])

  const enterCamera = async (index: number | null = null) => {
    setNotice(null)
    pausedRef.current = false
    setPaused(false)
    setPhotoPreviewIndex(null)
    setRetakeIndex(index)
    setStep('capture')
    await wait(50)
    await camera.start()
  }

  const waitDuringCapture = async (duration: number, token: number) => {
    let remaining = duration
    while (remaining > 0 || pausedRef.current) {
      if (token !== cancelRef.current) return false
      if (pausedRef.current) {
        await wait(50)
        continue
      }
      const slice = Math.min(50, remaining)
      await wait(slice)
      remaining -= slice
    }
    return token === cancelRef.current
  }

  const runCountdown = async (token: number) => {
    for (let remaining = countdownSeconds; remaining > 0; remaining -= 1) {
      if (token !== cancelRef.current) return false
      if (!await waitDuringCapture(0, token)) return false
      setCountdown(remaining)
      playTone(sound)
      if (!await waitDuringCapture(1000, token)) return false
    }
    setCountdown(null)
    return waitDuringCapture(0, token)
  }

  const takeFrame = async (token: number) => {
    const ready = await runCountdown(token)
    if (!ready) return null
    const brightness = flashMode === 'auto' ? camera.measureBrightness() : null
    const needsFlash = flashMode === 'on' || (flashMode === 'auto' && brightness !== null && brightness < 0.3)
    let torchOn = false
    try {
      if (needsFlash) {
        do {
          if (!await waitDuringCapture(0, token)) return null
          torchOn = await camera.setTorch(true)
          if (!torchOn) setScreenFlash(true)
          await wait(torchOn ? 180 : 240)
          if (pausedRef.current) {
            setScreenFlash(false)
            if (torchOn) await camera.setTorch(false)
            torchOn = false
          }
        } while (pausedRef.current)
      }
      if (!await waitDuringCapture(0, token)) return null
      const dataUrl = camera.capture(mirror, zoomMode === 'web' ? cameraTransform : DEFAULT_CAMERA_TRANSFORM)
      if (!dataUrl) throw new Error('Camera chưa sẵn sàng. Hãy thử lại.')
      playTone(sound, 260)
      return { id: makeId('photo'), dataUrl } satisfies CapturedPhoto
    } finally {
      setScreenFlash(false)
      if (torchOn) await camera.setTorch(false)
    }
  }

  const startCapture = async () => {
    if (capturing || !camera.active) return
    const token = cancelRef.current + 1
    cancelRef.current = token
    setCapturing(true)
    pausedRef.current = false
    setPaused(false)
    setNotice(null)
    try {
      if (retakeIndex !== null) {
        const photo = await takeFrame(token)
        if (photo && token === cancelRef.current) {
          const replacedId = photos[retakeIndex]?.id
          setPhotos((current) => current.map((item, index) => index === retakeIndex ? photo : item))
          if (replacedId) {
            setCandidatePhotos((current) => current.map((item) => item.id === replacedId ? photo : item))
            setSelectedCandidateIds((current) => current.map((id) => id === replacedId ? photo.id : id))
          }
          camera.stop()
          setRetakeIndex(null)
          setStep('edit')
        }
        return
      }

      for (let index = capturePool.length; index < captureTarget; index += 1) {
        const photo = await takeFrame(token)
        if (!photo || token !== cancelRef.current) return
        if (captureMode === 'photo-gallery') setCandidatePhotos((current) => [...current, photo])
        else setPhotos((current) => [...current, photo])
        if (index < captureTarget - 1 && !await waitDuringCapture(800, token)) return
      }
      camera.stop()
      if (captureMode === 'photo-gallery') {
        setSelectedCandidateIds([])
        setStep('select')
      } else {
        setStep('edit')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể chụp ảnh.')
    } finally {
      if (token === cancelRef.current) {
        setCapturing(false)
        setCountdown(null)
        pausedRef.current = false
        setPaused(false)
        setMotionPhase('idle')
      }
    }
  }

  const cancelCapture = () => {
    cancelRef.current += 1
    setCapturing(false)
    setCountdown(null)
    pausedRef.current = false
    setPaused(false)
    setScreenFlash(false)
    setMotionPhase('idle')
    void camera.setTorch(false)
    setNotice(capturePool.length ? 'Đã giữ các ảnh vừa chụp. Bạn có thể chụp tiếp.' : 'Đã hủy lượt chụp.')
  }

  const togglePause = () => {
    if (!capturing) return
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    setNotice(next ? 'Đã tạm dừng. Ấn tiếp tục khi bạn sẵn sàng.' : 'Đang tiếp tục chuỗi chụp.')
  }

  const reset = () => {
    cancelRef.current += 1
    pausedRef.current = false
    setPaused(false)
    camera.stop()
    setPhotos([])
    setCandidatePhotos([])
    setSelectedCandidateIds([])
    setMotionClip(null)
    setMotionPhase('idle')
    setStickers([])
    setFilter('original')
    setCaption('KHOẢNH KHẮC')
    setSessionDate(new Date())
    setRetakeIndex(null)
    setNotice(null)
    setSelectedStickerId(null)
    setCollageSettings({
      format: 'story',
      background: DEFAULT_COLLAGE_BACKGROUND,
      backgroundImageUrl: undefined,
      pattern: 'solid',
      message: '',
      messageColor: '#ffffff',
      messagePosition: 'bottom',
      items: [createSingleCollageItem('collage-main')],
    })
    setSelectedCollageItemId('collage-main')
    setEditorPanelTab('design')
    setCameraTransform(DEFAULT_CAMERA_TRANSFORM)
    setPreviewOpen(false)
    setPhotoPreviewIndex(null)
    setGalleryShare(null)
    setGalleryShareOpen(false)
    setStep('setup')
  }

  const toggleCandidate = (id: string) => {
    setSelectedCandidateIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id)
      if (current.length >= layout.slots) {
        setNotice(`Bạn chỉ cần chọn ${layout.slots} ảnh cho photobooth.`)
        return current
      }
      return [...current, id]
    })
  }

  const confirmPhotoSelection = async () => {
    if (selectedCandidateIds.length !== layout.slots || preparingSelection) return
    setPreparingSelection(true)
    setMotionPhase('encoding')
    setNotice(null)
    try {
      const selected = selectedCandidateIds
        .map((id) => candidatePhotos.find((photo) => photo.id === id))
        .filter((photo): photo is CapturedPhoto => Boolean(photo))
      const clip = await createPhotoMotionClip(candidatePhotos.map((photo) => photo.dataUrl))
      setPhotos(selected)
      setMotionClip((current) => {
        revokeMotionClip(current)
        return clip
      })
      setStep('edit')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể tạo ảnh chuyển động.')
    } finally {
      setMotionPhase('idle')
      setPreparingSelection(false)
    }
  }

  const addSticker = (asset: StickerAsset) => {
    if (stickers.length >= 20) {
      setNotice('Mỗi bộ ảnh dùng tối đa 20 sticker.')
      return
    }
    const offset = stickers.length * 0.055
    const next: BoothSticker = {
      id: makeId('sticker'), assetId: asset.id, name: asset.name, kind: asset.kind, content: asset.content,
      x: Math.min(.72, .18 + offset), y: Math.min(.72, .14 + offset), size: .13, rotation: 0, flipX: false,
      zIndex: stickers.reduce((highest, item) => Math.max(highest, item.zIndex), 0) + 1,
    }
    setStickers((current) => [...current, next])
    setSelectedStickerId(next.id)
  }

  const moveSticker = (id: string, x: number, y: number) => {
    setStickers((current) => current.map((item) => item.id === id ? { ...item, x, y } : item))
  }

  const updateSticker = (id: string, changes: Partial<BoothSticker>) => {
    setStickers((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  const removeSticker = (id: string) => {
    setStickers((current) => current.filter((item) => item.id !== id))
    setSelectedStickerId((current) => current === id ? null : current)
  }

  const updateSelectedSticker = (changes: Partial<BoothSticker>) => {
    if (!selectedStickerId) return
    updateSticker(selectedStickerId, changes)
  }

  const duplicateSelectedSticker = () => {
    if (!selectedSticker || stickers.length >= 20) return
    const duplicate = { ...selectedSticker, id: makeId('sticker'), x: Math.min(.94, selectedSticker.x + .04), y: Math.min(.94, selectedSticker.y + .04), zIndex: stickers.length + 1 }
    setStickers((current) => [...current, duplicate])
    setSelectedStickerId(duplicate.id)
  }

  const removeSelectedSticker = () => {
    if (!selectedStickerId) return
    removeSticker(selectedStickerId)
  }

  const updateCollageItem = (id: string, changes: Partial<CollageItem>) => {
    setCollageSettings((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...changes } : item),
    }))
  }

  const moveCollageItem = (id: string, x: number, y: number) => {
    updateCollageItem(id, { x, y })
  }

  const removeCollageItem = (id: string) => {
    if (collageSettings.items.length <= 1) {
      setNotice('Nền ghép cần giữ lại ít nhất một bản photobooth.')
      return
    }
    const next = collageSettings.items.filter((item) => item.id !== id)
    setCollageSettings((current) => ({ ...current, items: next }))
    setSelectedCollageItemId((selected) => selected === id ? next[next.length - 1]?.id ?? null : selected)
  }

  const duplicateCollageItem = () => {
    if (collageSettings.items.length >= MAX_COLLAGE_ITEMS) {
      setNotice(`Nền ghép dùng tối đa ${MAX_COLLAGE_ITEMS} bản photobooth.`)
      return
    }
    const source = collageSettings.items.find((item) => item.id === selectedCollageItemId) ?? collageSettings.items.at(-1)
    if (!source) return
    const id = makeId('collage')
    const duplicate: CollageItem = {
      ...source,
      id,
      x: Math.min(1.05, source.x + 0.07),
      y: Math.min(1.05, source.y + 0.05),
      rotation: source.rotation + 4,
      zIndex: Math.max(...collageSettings.items.map((item) => item.zIndex), 0) + 1,
    }
    setCollageSettings((current) => ({ ...current, items: [...current.items, duplicate] }))
    setSelectedCollageItemId(id)
  }

  const useSingleCollage = () => {
    const item = createSingleCollageItem(makeId('collage'))
    setCollageSettings((current) => ({ ...current, items: [item] }))
    setSelectedCollageItemId(item.id)
  }

  const useTwoStripCollage = () => {
    const items = createTwoStripCollage([makeId('collage'), makeId('collage')])
    setCollageSettings((current) => ({ ...current, items }))
    setSelectedCollageItemId(items[1].id)
  }

  const handleZoom = (value: number) => {
    setCameraTransform((current) => ({ ...current, zoom: value }))
  }

  const selectCamera = (deviceId: string) => {
    setCameraTransform(DEFAULT_CAMERA_TRANSFORM)
    setZoomModeOverride(null)
    void camera.selectDevice(deviceId)
  }

  const addLocalFrame = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const added = await saveLocalFrame(file, file.name.replace(/\.[^.]+$/, ''), layout)
      setFrames((current) => [added, ...current])
      setFrame(added)
      setNotice('Đã lưu frame vào trình duyệt này.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể lưu frame.')
    }
  }

  const removeLocalFrame = async (item: BoothFrame) => {
    await deleteLocalFrame(item.id)
    if (item.assetUrl) URL.revokeObjectURL(item.assetUrl)
    setFrames((current) => current.filter((candidate) => candidate.id !== item.id))
    if (frame.id === item.id) setFrame(FALLBACK_FRAMES[0])
    setNotice('Đã xóa frame khỏi trình duyệt.')
  }

  const addLocalBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const added = await saveLocalBackground(file)
      setLocalBackgrounds((current) => [added, ...current])
      setCollageSettings((current) => ({ ...current, backgroundImageUrl: added.url }))
      setNotice('Đã lưu nền ghép vào trình duyệt này.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể lưu nền ghép.')
    }
  }

  const removeLocalBackground = async (item: LocalBackground) => {
    await deleteLocalBackground(item.id)
    setCollageSettings((current) => current.backgroundImageUrl === item.url ? { ...current, backgroundImageUrl: undefined } : current)
    setLocalBackgrounds((current) => current.filter((candidate) => candidate.id !== item.id))
    URL.revokeObjectURL(item.url)
    setNotice('Đã xóa nền ghép khỏi trình duyệt.')
  }

  const exportPhoto = async () => {
    setExporting(true)
    setNotice(null)
    try {
      if (editorPanelTab === 'background') await downloadCollage(session, collageSettings, format)
      else await downloadStrip(session, format)
      setNotice('Ảnh đã được tạo. Nếu chưa thấy file, hãy kiểm tra mục Tải xuống.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Xuất ảnh thất bại. Hãy thử lại.')
    } finally {
      setExporting(false)
    }
  }

  const publishLiveGallery = async () => {
    if (publishingGallery) return
    const galleryPhotos = captureMode === 'photo-gallery' && candidatePhotos.length === layout.slots * 2
      ? candidatePhotos
      : photos
    if (galleryPhotos.length < layout.slots) {
      setNotice('Bộ ảnh này chưa đủ dữ liệu để tạo LiveGallery.')
      return
    }
    setPublishingGallery(true)
    setNotice('Đang tải ảnh lên LiveGallery…')
    try {
      let clip = motionClip
      if (!clip) {
        clip = await createPhotoMotionClip(galleryPhotos.map((photo) => photo.dataUrl))
        setMotionClip(clip)
      }
      const stripBlob = await composeStripBlob(session, 'jpeg')
      const share = await publishGalleryAlbum({
        title: caption.trim() || 'Khoảnh khắc của bạn',
        message: collageSettings.message,
        layoutId: layout.id,
        selectedPhotoIds: photos.map((photo) => photo.id),
        photos: galleryPhotos,
        stripBlob,
        motion: clip,
      })
      const qrDataUrl = await QRCode.toDataURL(share.url, {
        width: 320,
        margin: 1,
        color: { dark: '#171412', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      setGalleryShare({ ...share, qrDataUrl })
      setGalleryShareOpen(true)
      setNotice('Album LiveGallery đã sẵn sàng để quét QR.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể tạo LiveGallery.')
    } finally {
      setPublishingGallery(false)
    }
  }

  const copyGalleryCode = async () => {
    if (!galleryShare) return
    try {
      await navigator.clipboard.writeText(galleryShare.shareCode)
      setNotice('Đã sao chép mã album.')
    } catch {
      setNotice(`Mã album: ${galleryShare.shareCode}`)
    }
  }

  const progressStep = step === 'select' ? 'capture' : step
  const stepOrder = ['setup', 'capture', 'edit']
  const currentStepIndex = stepOrder.indexOf(progressStep)
  const specimenFrames = Array.from({ length: layout.slots }, (_, index) => padFrame(index + 1))

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={reset} aria-label="Về bước chọn bố cục">
          <span className="brand-mark" aria-hidden="true"><CameraMark size={20} /></span>
          <span className="brand-text">
            <strong>Khoảnh Khắc</strong>
            <small>PHOTOBOOTH</small>
          </span>
        </button>

        <nav className="step-rail" aria-label="Tiến trình chụp">
          {([
            ['setup', '01', 'Bố cục'],
            ['capture', '02', 'Chụp ảnh'],
            ['edit', '03', 'Hoàn thiện'],
          ] as const).map(([value, number, label], index) => {
            const isActive = progressStep === value
            const isDone = currentStepIndex > index
            return (
              <div
                key={value}
                className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="step-index">
                  {isDone ? <Check size={12} aria-hidden="true" /> : number}
                </span>
                <span className="step-label">{label}</span>
              </div>
            )
          })}
        </nav>

        <div className="topbar-right">
          <div className="privacy-note">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>{captureMode === 'photo-gallery' ? 'Chỉ tải lên khi tạo LiveGallery' : 'Xử lý trực tiếp trên thiết bị'}</span>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang phòng tối'}
            aria-pressed={theme === 'light'}
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang phòng tối'}
          >
            {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            <span>{theme === 'dark' ? 'Sáng' : 'Tối'}</span>
          </button>
        </div>
      </header>

      {notices.length > 0 && (
        <div className="notice-stack" aria-live="polite" aria-relevant="additions">
          {notices.map((item) => (
            <div className="notice" role="status" key={item.id}>
              <span>{item.message}</span>
              <button
                type="button"
                onClick={() => setNotices((current) => current.filter((notice) => notice.id !== item.id))}
                aria-label="Đóng thông báo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <main className="booth-main">
        {step === 'setup' && (
          <section className="setup-grid">
            <div className="light-table" aria-label="Xem trước bố cục bản in">
              <div className="light-table__bar">
                <span className="mono-tag">BÀN SOI 35MM</span>
                <span className="mono-tag mono-tag--accent" data-testid="layout-dimensions">
                  {layout.width} × {layout.height} PX · {padFrame(layout.slots)} KHUNG
                </span>
              </div>

              <div className="light-table__copy">
                <h1>Chụp tại chỗ, in ngay khoảnh khắc.</h1>
                <p>Chọn khuôn in và chế độ chụp. Máy tự đếm ngược để bạn đổi dáng, sau đó tải bản in hoặc quét QR sang LiveGallery.</p>
              </div>

              <div className="specimen-bay">
                <span className="vf-corner vf-tl" aria-hidden="true" />
                <span className="vf-corner vf-tr" aria-hidden="true" />
                <span className="vf-corner vf-bl" aria-hidden="true" />
                <span className="vf-corner vf-br" aria-hidden="true" />

                <div className="sprocket-rail sprocket-rail--left" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
                </div>

                <div
                  className={`print-specimen specimen--${layout.id}`}
                  data-layout={layout.id}
                  aria-label={`Mô phỏng bản in ${layout.name}, ${layout.slots} khung ảnh`}
                >
                  <div className="specimen-frames">
                    {specimenFrames.map((frameCode, index) => (
                      <div key={frameCode} className={`specimen-frame tone-${(index % 4) + 1}`}>
                        <span className="specimen-frame-num">{frameCode}</span>
                      </div>
                    ))}
                  </div>
                  <div className="specimen-footer">
                    <strong>KHOẢNH KHẮC</strong>
                    <span>{layout.id === 'grid4' ? '2×2 · 35MM' : layout.id === 'polaroid' ? 'POLAROID · 01' : `35MM · ${padFrame(layout.slots)}F`}</span>
                  </div>
                </div>

                <div className="sprocket-rail sprocket-rail--right" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
                </div>
              </div>

              <div className="light-table__footer">
                <div className="light-table__summary">
                  <strong>{layout.name}</strong>
                  <span>
                    {captureMode === 'photo-gallery'
                      ? `Chụp ${captureTarget} khung gốc, chọn ${layout.slots} ảnh đẹp nhất`
                      : `Chụp trực tiếp ${layout.slots} khung in`}
                  </span>
                </div>
                <span className="mono-tag">
                  {padFrame(countdownSeconds)}S · FLASH {flashMode === 'off' ? 'OFF' : flashMode === 'auto' ? 'AUTO' : 'ON'}
                </span>
              </div>
            </div>

            <div className="setup-panel">
              <div className="panel-heading">
                <span className="panel-step-num">01</span>
                <div>
                  <h2>Chọn bố cục in</h2>
                  <p>Bản xem trước bên bàn soi cập nhật ngay theo lựa chọn của bạn.</p>
                </div>
              </div>

              <div className="layout-options" role="group" aria-label="Bố cục ảnh">
                {LAYOUTS.map((item) => {
                  const selected = layout.id === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLayout(item)}
                      aria-pressed={selected}
                      className={`layout-option ${selected ? 'selected' : ''}`}
                    >
                      <span className={`layout-icon ${item.kind} slots-${item.slots}`} aria-hidden="true">
                        {Array.from({ length: item.slots }, (_, index) => <i key={index} />)}
                      </span>
                      <span className="layout-option__copy">
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                      </span>
                      <span className="layout-option__meta">
                        {selected ? <Check size={16} aria-hidden="true" /> : `${padFrame(item.slots)}F`}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="capture-mode-setting">
                <span className="console-label">Loại phiên chụp</span>
                <div role="group" aria-label="Loại phiên chụp">
                  <button
                    type="button"
                    className={captureMode === 'photo' ? 'selected' : ''}
                    aria-pressed={captureMode === 'photo'}
                    onClick={() => setCaptureMode('photo')}
                  >
                    <ImageIcon size={16} aria-hidden="true" />
                    <span>
                      <strong>Chỉ ảnh</strong>
                      <small>Chụp đúng {layout.slots} khung ảnh</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={captureMode === 'photo-gallery' ? 'selected' : ''}
                    aria-pressed={captureMode === 'photo-gallery'}
                    onClick={() => setCaptureMode('photo-gallery')}
                  >
                    <Video size={16} aria-hidden="true" />
                    <span>
                      <strong>Ảnh + LiveGallery</strong>
                      <small>Chụp {layout.slots * 2} khung, chọn ảnh đẹp nhất</small>
                    </span>
                  </button>
                </div>
              </div>

              <div className="quick-settings">
                <label className="countdown-setting">
                  <span>Đếm ngược</span>
                  <span className="number-setting">
                    <input
                      aria-label="Số giây đếm ngược"
                      type="number"
                      min={0}
                      max={30}
                      value={countdownSeconds}
                      onChange={(event) => setCountdownSeconds(Math.min(30, Math.max(0, Number(event.target.value))))}
                    />
                    <span className="unit">giây</span>
                  </span>
                </label>
                <button
                  type="button"
                  className={sound ? 'toggle active' : 'toggle'}
                  aria-pressed={sound}
                  onClick={() => setSound((value) => !value)}
                >
                  {sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
                  <span>Âm chụp</span>
                </button>
              </div>

              <div className="flash-setting">
                <span><Zap size={15} aria-hidden="true" /> Flash</span>
                <div role="group" aria-label="Chế độ flash">
                  {(['off', 'auto', 'on'] as FlashMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={flashMode === mode ? 'selected' : ''}
                      aria-pressed={flashMode === mode}
                      onClick={() => setFlashMode(mode)}
                    >
                      {mode === 'off' ? 'Tắt' : mode === 'auto' ? 'Tự động' : 'Bật'}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" className="primary-button shutter-cta" onClick={() => void enterCamera()}>
                <Camera size={19} aria-hidden="true" />
                <span>Bật camera</span>
              </button>
              <p className="permission-copy">Trình duyệt sẽ hỏi quyền camera. Photobooth không dùng microphone.</p>
            </div>
          </section>
        )}

        {step === 'capture' && (
          <section className="capture-layout">
            <div className="camera-card">
              <div className="camera-stage">
                <span className="vf-corner vf-tl" aria-hidden="true" />
                <span className="vf-corner vf-tr" aria-hidden="true" />
                <span className="vf-corner vf-bl" aria-hidden="true" />
                <span className="vf-corner vf-br" aria-hidden="true" />

                <video
                  ref={camera.videoRef}
                  muted
                  playsInline
                  style={{
                    transform: `${mirror ? 'scaleX(-1) ' : ''}scale(${zoomMode === 'web' ? cameraTransform.zoom : 1}) translate(${zoomMode === 'web' ? -cameraTransform.offsetX * 8 : 0}%, ${zoomMode === 'web' ? -cameraTransform.offsetY * 8 : 0}%)`,
                  }}
                />
                {!camera.active && (
                  <div className="camera-placeholder">
                    {camera.loading ? <LoaderCircle className="spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
                    <p>{camera.loading ? 'Đang mở camera…' : camera.error ?? 'Camera đang tắt'}</p>
                    {!camera.loading && (
                      <button type="button" onClick={() => void camera.start()}>Thử lại</button>
                    )}
                  </div>
                )}
                {countdown !== null && (
                  <div className="countdown">
                    <span>{countdown}</span>
                    <small>Chuẩn bị nhé!</small>
                  </div>
                )}
                {motionPhase === 'encoding' && (
                  <div className="motion-encoding">
                    <LoaderCircle className="spin" aria-hidden="true" />
                    <strong>Đang tạo ảnh động…</strong>
                  </div>
                )}
                {paused && (
                  <div className="pause-overlay">
                    <Pause size={40} aria-hidden="true" />
                    <strong>Đã tạm dừng</strong>
                    <span>Ấn Tiếp tục để chụp tiếp.</span>
                  </div>
                )}
                {screenFlash && <div className="flash" />}
                <div className="camera-progress">
                  {retakeIndex !== null
                    ? `RETAKE ${padFrame(retakeIndex + 1)}`
                    : `FRAME ${padFrame(Math.min(capturePool.length + 1, captureTarget))} / ${padFrame(captureTarget)}`}
                </div>
                <div className="camera-telemetry">
                  {camera.resolution
                    ? `${camera.resolution.width}×${camera.resolution.height}`
                    : `${layout.width}×${layout.height}`}
                </div>
              </div>

              <div className="camera-actions">
                <button type="button" className="icon-button" onClick={() => setMirror((value) => !value)} disabled={capturing} aria-label="Lật ảnh" title="Lật ảnh">
                  <FlipHorizontal2 size={18} aria-hidden="true" />
                </button>
                <button type="button" className="shutter" onClick={() => void startCapture()} disabled={!camera.active || capturing} aria-label="Bắt đầu chụp">
                  <span />
                </button>
                {capturing && (
                  <button type="button" className="icon-button pause-button" onClick={togglePause} aria-label={paused ? 'Tiếp tục chụp' : 'Tạm dừng chụp'} title={paused ? 'Tiếp tục chụp' : 'Tạm dừng chụp'}>
                    {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
                  </button>
                )}
                <button type="button" className="icon-button" onClick={() => void camera.switchFacing()} disabled={capturing} aria-label="Đổi camera" title="Đổi camera">
                  <SwitchCamera size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="camera-tools">
                {zoomMode === 'web'
                  ? (
                    <label>
                      <ZoomIn size={15} aria-hidden="true" />
                      <input aria-label="Zoom camera" type="range" min={1} max={3} step={.05} value={cameraTransform.zoom} onChange={(event) => handleZoom(Number(event.target.value))} />
                      <span className="mono-value">{cameraTransform.zoom.toFixed(1)}×</span>
                    </label>
                  )
                  : <span className="device-zoom-hint"><ZoomIn size={15} aria-hidden="true" /> Zoom trực tiếp trên máy ảnh</span>}
                <div className="flash-modes" role="group" aria-label="Đèn flash">
                  {(['off', 'auto', 'on'] as FlashMode[]).map((mode) => (
                    <button key={mode} type="button" className={flashMode === mode ? 'selected' : ''} aria-pressed={flashMode === mode} onClick={() => setFlashMode(mode)} disabled={capturing}>
                      {mode === 'off' ? 'Tắt' : mode === 'auto' ? 'Auto' : 'Bật'}
                    </button>
                  ))}
                </div>
              </div>
              {capturing && <button type="button" className="cancel-button" onClick={cancelCapture}>Hủy chuỗi chụp</button>}
            </div>

            <aside className="capture-side">
              <div className="capture-side__head">
                <p className="eyebrow">{layout.name} · {padFrame(captureTarget)} KHUNG</p>
                <h1>Đổi dáng sau mỗi tiếng bíp</h1>
                <p>Mỗi ảnh có {countdownSeconds} giây chuẩn bị.{captureMode === 'photo-gallery' && ` Máy sẽ chụp ${captureTarget} tấm để bạn chọn ${layout.slots} tấm cho photobooth; toàn bộ ảnh tạo chuyển động ở tốc độ 0,75 giây/ảnh trên LiveGallery.`}</p>
              </div>

              {camera.devices.length > 1 && (
                <label className="device-picker">
                  <span>Máy ảnh</span>
                  <select value={camera.selectedDeviceId ?? ''} onChange={(event) => selectCamera(event.target.value)} disabled={capturing}>
                    {camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
                  </select>
                </label>
              )}

              <div className="zoom-source">
                <span>Điều khiển zoom</span>
                <div role="group" aria-label="Cách điều khiển zoom">
                  <button type="button" className={zoomMode === 'web' ? 'selected' : ''} aria-pressed={zoomMode === 'web'} onClick={() => { setZoomModeOverride('web'); setCameraTransform(DEFAULT_CAMERA_TRANSFORM) }} disabled={capturing}>Trong web</button>
                  <button type="button" className={zoomMode === 'device' ? 'selected' : ''} aria-pressed={zoomMode === 'device'} onClick={() => { setZoomModeOverride('device'); setCameraTransform(DEFAULT_CAMERA_TRANSFORM) }} disabled={capturing}>Trên máy ảnh</button>
                </div>
              </div>

              <div className="camera-capabilities">
                <p className="camera-capability"><Zap size={14} aria-hidden="true" /> {camera.torchSupported ? 'Camera hỗ trợ đèn phần cứng' : 'Dùng flash màn hình khi cần'}</p>
                {camera.resolution && <p className="camera-capability"><ImageIcon size={14} aria-hidden="true" /> <span className="mono-value">{camera.resolution.width} × {camera.resolution.height} px</span></p>}
              </div>

              <div className="contact-sheet-block">
                <div className="contact-sheet-head">
                  <span>BẢNG PHIM</span>
                  <span className="mono-value">{padFrame(capturePool.length)} / {padFrame(captureTarget)}</span>
                </div>
                <div className={`photo-slots ${captureTarget > 4 ? 'many' : ''}`}>
                  {Array.from({ length: captureTarget }, (_, index) => (
                    <div key={index} className={capturePool[index] ? 'filled' : ''}>
                      {capturePool[index]
                        ? <>
                            <img src={capturePool[index].dataUrl} alt={`Ảnh ${index + 1}`} />
                            <em className="slot-tag">{padFrame(index + 1)}</em>
                          </>
                        : <span>{padFrame(index + 1)}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={() => { camera.stop(); setStep(capturePool.length === captureTarget ? (captureMode === 'photo-gallery' ? 'select' : 'edit') : 'setup') }}
              >
                <ChevronLeft size={17} aria-hidden="true" /> Quay lại
              </button>
            </aside>
          </section>
        )}

        {step === 'select' && (
          <section className="selection-screen">
            <div className="selection-heading">
              <div>
                <p className="eyebrow">BẢNG PHIM · CHỌN ẢNH IN</p>
                <h1>Giữ lại {layout.slots} khoảnh khắc bạn thích</h1>
                <p>Toàn bộ {candidatePhotos.length} ảnh được lưu trong LiveGallery và ghép ở tốc độ 0,75 giây/ảnh.</p>
              </div>
              <div className="selection-count">
                <strong>{padFrame(selectedCandidateIds.length)}</strong>
                <span>/ {padFrame(layout.slots)} KHUNG</span>
              </div>
            </div>
            <div className="candidate-grid">
              {candidatePhotos.map((photo, index) => {
                const selectedIndex = selectedCandidateIds.indexOf(photo.id)
                return (
                  <button
                    key={photo.id}
                    type="button"
                    className={selectedIndex >= 0 ? 'candidate selected' : 'candidate'}
                    onClick={() => toggleCandidate(photo.id)}
                    aria-pressed={selectedIndex >= 0}
                  >
                    <img src={photo.dataUrl} alt={`Ảnh chụp ${index + 1}`} />
                    <span className="candidate-number">{padFrame(index + 1)}</span>
                    {selectedIndex >= 0
                      ? <span className="candidate-choice"><Check size={15} aria-hidden="true" /> Ảnh in {padFrame(selectedIndex + 1)}</span>
                      : <span className="candidate-choice muted">Lưu vào LiveGallery</span>}
                  </button>
                )
              })}
            </div>
            <div className="selection-actions">
              <button type="button" className="text-button" onClick={() => { setCandidatePhotos([]); setSelectedCandidateIds([]); void enterCamera() }}>
                <RotateCcw size={17} aria-hidden="true" /> Chụp lại toàn bộ
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={selectedCandidateIds.length !== layout.slots || preparingSelection}
                onClick={() => void confirmPhotoSelection()}
              >
                {preparingSelection ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                <span>{preparingSelection ? 'Đang tạo ảnh động…' : 'Dùng các ảnh đã chọn'}</span>
              </button>
            </div>
          </section>
        )}

        {step === 'edit' && (
          <section className="editor-layout">
            <div className={`preview-column ${editorPanelTab === 'background' ? 'collage-mode' : ''}`}>
              <div className="preview-column-toolbar">
                <div>
                  <p className="eyebrow">{editorPanelTab === 'background' ? 'Nền ghép của bạn' : 'Bàn in phòng tối'}</p>
                  <span className="mono-spec">{outputSize.width} × {outputSize.height} PX</span>
                </div>
                <button type="button" className="preview-open-button" onClick={openPreview}>
                  <Eye size={16} aria-hidden="true" /> Xem trước
                </button>
              </div>
              <div className="preview-stage">
                {editorPanelTab === 'background'
                  ? <CollageEditor
                      session={session}
                      settings={collageSettings}
                      selectedId={selectedCollageItemId}
                      onSelect={setSelectedCollageItemId}
                      onMove={moveCollageItem}
                      onUpdate={updateCollageItem}
                      onRemove={removeCollageItem}
                    />
                  : <StripPreview session={session} interactive onMoveSticker={moveSticker} onUpdateSticker={updateSticker} onRemoveSticker={removeSticker} selectedStickerId={selectedStickerId} onSelectSticker={setSelectedStickerId} onPreview={openPreview} />}
              </div>
              <div className="retake-row">
                {photos.map((photo, index) => (
                  <button key={photo.id} type="button" onClick={() => setPhotoPreviewIndex(index)}>
                    <img src={photo.dataUrl} alt="" />
                    <span><em className="mono-value">{padFrame(index + 1)}</em> Xem</span>
                  </button>
                ))}
                {motionClip && (
                  <button type="button" className="motion-review-button" onClick={() => setMotionPreviewOpen(true)}>
                    <img src={motionClip.gifUrl} alt="Ảnh động LiveGallery" />
                    <span><Video size={13} aria-hidden="true" /> GIF</span>
                  </button>
                )}
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-title">
                <div>
                  <p className="eyebrow">Bước cuối</p>
                  <h1>Thêm chút dấu ấn</h1>
                </div>
                <button type="button" className="text-button new-session-button" onClick={reset} aria-label="Chụp bộ mới">
                  <RefreshCcw size={15} aria-hidden="true" />
                  <span>Chụp bộ mới</span>
                </button>
              </div>
              <div className="editor-tabs editor-tabs-single" role="group" aria-label="Tùy chỉnh ảnh">
                <button type="button" aria-pressed="true" className="selected">Bộ lọc & khung</button>
                <span className="editor-tabs-note">Sticker và nền ghép chỉnh tiếp trong LiveGallery.</span>
              </div>

              {editorPanelTab === 'design' && (
                <div className="editor-design">
                  <section className="control-section filter-section">
                    <h2>Bộ lọc màu</h2>
                    <div className="filter-grid">
                      {FILTERS.map((item) => (
                        <button key={item.id} type="button" className={filter === item.id ? 'selected' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                          <span style={{ filter: item.css }} />
                          <small>{item.name}</small>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="control-section frame-section">
                    <div className="section-line">
                      <h2>Khung ảnh</h2>
                      <span className={remoteFrames ? 'source online' : 'source'}>{remoteFrames ? 'Supabase + máy' : 'Bản mẫu + máy'}</span>
                    </div>
                    <div className="frame-grid">
                      {visibleFrames.map((item) => (
                        <div className="frame-option" key={item.id}>
                          <button type="button" title={item.description} className={frame.id === item.id ? 'selected' : ''} aria-pressed={frame.id === item.id} onClick={() => setFrame(item)}>
                            {item.assetUrl ? <img src={item.assetUrl} alt="" /> : <i style={{ background: item.config.background, borderColor: item.config.accent }} />}
                            <span>{item.name}</span>
                          </button>
                          {item.source === 'local' && (
                            <button type="button" className="delete-frame" onClick={() => void removeLocalFrame(item)} aria-label={`Xóa ${item.name}`}>
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="add-frame" onClick={() => frameInputRef.current?.click()}>
                        <Plus size={16} aria-hidden="true" /> Thêm frame
                      </button>
                    </div>
                    <input ref={frameInputRef} className="visually-hidden" type="file" accept="image/png,image/webp" onChange={addLocalFrame} />
                    <p className="hint">PNG/WebP tối đa 5 MB, có đúng số ô ảnh trong suốt. Giữ nguyên tỷ lệ khung gốc; lưu riêng trong trình duyệt này.</p>
                  </section>

                  <section className="control-section caption-section">
                    <h2>Lời nhắn</h2>
                    <div className="caption-field">
                      <input aria-label="Lời nhắn trên bản in" value={caption} disabled={Boolean(frame.assetUrl)} maxLength={60} onChange={(event) => setCaption(event.target.value)} placeholder="KHOẢNH KHẮC" />
                      <span className="mono-value">{caption.length}/60</span>
                    </div>
                    <label className="check-line">
                      <input type="checkbox" disabled={Boolean(frame.assetUrl)} checked={showDate} onChange={(event) => setShowDate(event.target.checked)} />
                      <span>Hiện ngày chụp</span>
                    </label>
                    {frame.assetUrl && <p className="hint">Frame này dùng thiết kế footer có sẵn nên lời nhắn và ngày mặc định được ẩn.</p>}
                  </section>
                </div>
              )}

              {editorPanelTab === 'stickers' && (
                <div className="editor-stickers">
                  <section className="control-section sticker-section">
                    <div className="section-line"><h2>Sticker</h2><span className="mono-value">{stickers.length}/20 · {remoteStickers ? 'Supabase' : 'Có sẵn'}</span></div>
                    <div className="sticker-categories">{STICKER_CATEGORIES.map((category) => <button key={category.id} type="button" className={stickerCategory === category.id ? 'selected' : ''} onClick={() => setStickerCategory(category.id)}>{category.name}</button>)}</div>
                    <div className="sticker-library">{visibleStickerAssets.map((asset) => <button key={asset.id} type="button" onClick={() => addSticker(asset)} title={asset.name}>{asset.kind === 'image' ? <img src={asset.content} alt={asset.name} loading="lazy" /> : <span>{asset.content}</span>}</button>)}</div>
                    {selectedSticker && (
                      <div className="sticker-tools">
                        <label>Kích thước<input type="range" min={.06} max={.36} step={.01} value={selectedSticker.size} onChange={(event) => updateSelectedSticker({ size: Number(event.target.value) })} /></label>
                        <button type="button" onClick={() => updateSelectedSticker({ rotation: selectedSticker.rotation + 15 })} aria-label="Xoay sticker" title="Xoay"><RotateCw size={16} aria-hidden="true" /></button>
                        <button type="button" onClick={() => updateSelectedSticker({ flipX: !selectedSticker.flipX })} aria-label="Lật ngang sticker" title="Lật ngang"><FlipHorizontal2 size={16} aria-hidden="true" /></button>
                        <button type="button" onClick={() => updateSelectedSticker({ zIndex: stickers.length + 1 })} aria-label="Đưa lên trước" title="Đưa lên trước"><Layers size={16} aria-hidden="true" /></button>
                        <button type="button" onClick={duplicateSelectedSticker} aria-label="Nhân bản sticker" title="Nhân bản"><Copy size={16} aria-hidden="true" /></button>
                        <button type="button" onClick={removeSelectedSticker} aria-label="Xóa sticker" title="Xóa"><Trash2 size={16} aria-hidden="true" /></button>
                      </div>
                    )}
                    <div className="sticker-footer"><p className="hint">Chạm để thêm, kéo trực tiếp trên ảnh. Dùng phím mũi tên để căn chính xác.</p>{stickers.length > 0 && <button type="button" onClick={() => { setStickers([]); setSelectedStickerId(null) }}>Xóa tất cả</button>}</div>
                  </section>
                </div>
              )}

              {editorPanelTab === 'background' && (
                <div className="editor-background">
                  <section className="control-section collage-section">
                    <div className="section-line"><h2>Khổ nền</h2><span className="mono-value">{outputSize.width} × {outputSize.height} px</span></div>
                    <div className="collage-formats">
                      {COLLAGE_FORMATS.map((item) => <button key={item.id} type="button" className={collageSettings.format === item.id ? 'selected' : ''} onClick={() => setCollageSettings((current) => ({ ...current, format: item.id }))}>{item.name}</button>)}
                    </div>

                    <div className="section-line collage-heading"><h2>Màu & họa tiết</h2><label className="color-picker" title="Chọn màu nền"><input type="color" value={collageSettings.background} onChange={(event) => setCollageSettings((current) => ({ ...current, background: event.target.value }))} /><span>Màu tùy chỉnh</span></label></div>
                    <div className="background-swatches">
                      {COLLAGE_BACKGROUNDS.map((color) => <button key={color} type="button" className={collageSettings.background === color ? 'selected' : ''} style={{ background: color }} onClick={() => setCollageSettings((current) => ({ ...current, background: color }))} aria-label={`Chọn màu nền ${color}`} />)}
                    </div>
                    <div className="section-line collage-heading"><h2>Nền ảnh</h2><span className={remoteBackgroundSource ? 'source online' : 'source'}>{remoteBackgroundSource ? 'Supabase + máy' : 'Trên máy'}</span></div>
                    <div className="local-background-grid">
                      <button type="button" className={!collageSettings.backgroundImageUrl ? 'selected background-color-only' : 'background-color-only'} onClick={() => setCollageSettings((current) => ({ ...current, backgroundImageUrl: undefined }))}><span style={{ background: collageSettings.background }} />Chỉ dùng màu</button>
                      {remoteBackgrounds.map((item) => <div className="local-background-option remote" key={item.id}>
                        <button type="button" className={collageSettings.backgroundImageUrl === item.url ? 'selected' : ''} onClick={() => setCollageSettings((current) => ({ ...current, backgroundImageUrl: item.url }))} title={item.name}><img src={item.url} alt="" /><span>{item.name}</span></button>
                      </div>)}
                      {localBackgrounds.map((item) => <div className="local-background-option" key={item.id}>
                        <button type="button" className={collageSettings.backgroundImageUrl === item.url ? 'selected' : ''} onClick={() => setCollageSettings((current) => ({ ...current, backgroundImageUrl: item.url }))} title={item.name}><img src={item.url} alt="" /><span>{item.name}</span></button>
                        <button type="button" className="delete-background" onClick={() => void removeLocalBackground(item)} aria-label={`Xóa nền ${item.name}`}><Trash2 size={13} aria-hidden="true" /></button>
                      </div>)}
                      <button type="button" className="add-background" onClick={() => backgroundInputRef.current?.click()}><Plus size={16} aria-hidden="true" /> Thêm nền</button>
                    </div>
                    <input ref={backgroundInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={addLocalBackground} />
                    <p className="hint compact">PNG, JPG hoặc WebP tối đa 8 MB; ảnh được lưu riêng trong trình duyệt này.</p>
                    <div className="pattern-switch" role="group" aria-label="Họa tiết nền">
                      {([['solid', 'Trơn'], ['dots', 'Chấm'], ['grid', 'Ô lưới']] as const).map(([value, label]) => <button key={value} type="button" className={collageSettings.pattern === value ? 'selected' : ''} onClick={() => setCollageSettings((current) => ({ ...current, pattern: value }))}>{label}</button>)}
                    </div>

                    <div className="section-line collage-heading"><h2>Lời nhắn trên nền</h2><label className="color-picker" title="Chọn màu chữ"><input type="color" value={collageSettings.messageColor} onChange={(event) => setCollageSettings((current) => ({ ...current, messageColor: event.target.value }))} /><span>Màu chữ</span></label></div>
                    <div className="caption-field"><input aria-label="Lời nhắn trên nền" value={collageSettings.message} maxLength={80} onChange={(event) => setCollageSettings((current) => ({ ...current, message: event.target.value }))} placeholder="Nhập lời nhắn…" /><span className="mono-value">{collageSettings.message.length}/80</span></div>
                    <div className="pattern-switch message-position-switch" role="group" aria-label="Vị trí lời nhắn">
                      {([['top', 'Phía trên'], ['bottom', 'Phía dưới']] as const).map(([value, label]) => <button key={value} type="button" className={collageSettings.messagePosition === value ? 'selected' : ''} onClick={() => setCollageSettings((current) => ({ ...current, messagePosition: value }))}>{label}</button>)}
                    </div>

                    <div className="section-line collage-heading"><h2>Xếp photobooth</h2><span className="mono-value">{collageSettings.items.length}/{MAX_COLLAGE_ITEMS} bản</span></div>
                    <div className="collage-presets">
                      <button type="button" onClick={useSingleCollage}>Một bản giữa nền</button>
                      <button type="button" onClick={useTwoStripCollage}>Hai dải chéo</button>
                      <button type="button" className="accent" onClick={duplicateCollageItem} disabled={collageSettings.items.length >= MAX_COLLAGE_ITEMS}><Copy size={16} aria-hidden="true" /> Lặp thêm</button>
                    </div>

                    {selectedCollageItem && (
                      <div className="collage-tools">
                        <label>Kích thước<input type="range" min={.12} max={.95} step={.01} value={selectedCollageItem.width} onChange={(event) => updateCollageItem(selectedCollageItem.id, { width: Number(event.target.value) })} /></label>
                        <label>Xoay<input type="range" min={-180} max={180} step={1} value={selectedCollageItem.rotation} onChange={(event) => updateCollageItem(selectedCollageItem.id, { rotation: Number(event.target.value) })} /></label>
                        <div>
                          <button type="button" onClick={() => updateCollageItem(selectedCollageItem.id, { zIndex: Math.max(...collageSettings.items.map((item) => item.zIndex), 0) + 1 })} aria-label="Đưa lên trước" title="Đưa lên trước"><Layers size={16} aria-hidden="true" /></button>
                          <button type="button" onClick={duplicateCollageItem} aria-label="Lặp bản đang chọn" title="Lặp bản đang chọn" disabled={collageSettings.items.length >= MAX_COLLAGE_ITEMS}><Copy size={16} aria-hidden="true" /></button>
                          <button type="button" onClick={() => removeCollageItem(selectedCollageItem.id)} aria-label="Xóa bản đang chọn" title="Xóa bản đang chọn" disabled={collageSettings.items.length <= 1}><Trash2 size={16} aria-hidden="true" /></button>
                        </div>
                      </div>
                    )}
                    <p className="hint">Kéo trực tiếp từng bản trên nền. Dùng các nút tròn trên bản được chọn để xoay, xóa hoặc đổi kích thước.</p>
                  </section>
                </div>
              )}

              <div className="export-stack">
                {motionClip && (
                  <section className="motion-export-card">
                    <div>
                      <Video size={18} aria-hidden="true" />
                      <span>
                        <strong>Khoảnh khắc chuyển động</strong>
                        <small>Tất cả {(captureMode === 'photo-gallery' && candidatePhotos.length ? candidatePhotos : photos).length} ảnh ghép thành GIF, 0,75 giây/ảnh · {(motionClip.durationMs / 1000).toLocaleString('vi-VN')} giây</small>
                      </span>
                    </div>
                    <div>
                      <button type="button" onClick={() => downloadMotionBlob(motionClip.gifBlob, 'gif')}>
                        <Download size={15} aria-hidden="true" /> GIF
                      </button>
                    </div>
                  </section>
                )}

                <section className="gallery-export-card">
                  <div>
                    <span className="gallery-export-icon" aria-hidden="true"><Video size={18} /></span>
                    <span>
                      <strong>LiveGallery riêng</strong>
                      <small>Nhận mã QR để tải ảnh về điện thoại, gắn sticker và ghép nền trên LiveGallery.</small>
                    </span>
                  </div>
                  {galleryShare
                    ? (
                      <button type="button" className="gallery-ready-button" onClick={() => setGalleryShareOpen(true)}>
                        <Eye size={16} aria-hidden="true" />
                        <span>Xem QR · <em className="mono-value">{galleryShare.shareCode.toUpperCase()}</em></span>
                      </button>
                    )
                    : (
                      <button type="button" className="primary-button" onClick={() => void publishLiveGallery()} disabled={publishingGallery}>
                        {publishingGallery ? <LoaderCircle className="spin" aria-hidden="true" /> : <ImageIcon size={17} aria-hidden="true" />}
                        <span>{publishingGallery ? 'Đang tạo album…' : 'Tạo mã QR LiveGallery'}</span>
                      </button>
                    )}
                </section>

                <section className="download-card">
                  <div>
                    <ImageIcon size={18} aria-hidden="true" />
                    <span>
                      <strong className="mono-value">{outputSize.width} × {outputSize.height} PX</strong>
                      <small>{editorPanelTab === 'background' ? 'Ảnh nền ghép chất lượng cao' : 'Bản in chất lượng cao'}</small>
                    </span>
                  </div>
                  <div className="format-switch" role="group" aria-label="Định dạng file">
                    <button type="button" className={format === 'png' ? 'selected' : ''} aria-pressed={format === 'png'} onClick={() => setFormat('png')}>PNG</button>
                    <button type="button" className={format === 'jpeg' ? 'selected' : ''} aria-pressed={format === 'jpeg'} onClick={() => setFormat('jpeg')}>JPG</button>
                  </div>
                  <button type="button" className="primary-button" onClick={() => void exportPhoto()} disabled={exporting}>
                    {exporting ? <LoaderCircle className="spin" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
                    <span>{exporting ? 'Đang tạo ảnh…' : editorPanelTab === 'background' ? 'Tải ảnh ghép' : 'Tải ảnh về'}</span>
                  </button>
                </section>
              </div>
            </div>
          </section>
        )}
      </main>

      {previewOpen && (
        <div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false) }}>
          <div className="preview-modal-card">
            <div className="preview-modal-head">
              <div><p className="eyebrow">Bản hoàn chỉnh</p><h2 id="preview-title">{editorPanelTab === 'background' ? 'Xem trước nền ghép' : 'Xem trước ảnh photobooth'}</h2></div>
              <div className="preview-modal-actions">
                <button type="button" onClick={() => setReviewZoom(previewView.zoom - .25)} disabled={previewView.zoom <= .75} aria-label="Thu nhỏ"><ZoomOut size={18} aria-hidden="true" /></button>
                <output aria-live="polite">{Math.round(previewView.zoom * 100)}%</output>
                <button type="button" onClick={() => setReviewZoom(previewView.zoom + .25)} disabled={previewView.zoom >= 4} aria-label="Phóng to"><ZoomIn size={18} aria-hidden="true" /></button>
                <button type="button" onClick={() => setPreviewView({ zoom: 1, x: 0, y: 0 })} aria-label="Đặt lại zoom"><RotateCcw size={18} aria-hidden="true" /></button>
                <button type="button" autoFocus onClick={() => setPreviewOpen(false)} aria-label="Đóng xem trước"><X size={18} aria-hidden="true" /></button>
              </div>
            </div>
            <div
              className="preview-modal-image"
              tabIndex={0}
              aria-label="Vùng ảnh có thể kéo để xem chi tiết"
              onWheel={(event) => { event.preventDefault(); setReviewZoom(previewView.zoom + (event.deltaY < 0 ? .25 : -.25)) }}
              onDoubleClick={() => setPreviewView({ zoom: 1, x: 0, y: 0 })}
              onKeyDown={(event) => {
                const stepSize = event.shiftKey ? 80 : 30
                const delta = { ArrowLeft: [stepSize, 0], ArrowRight: [-stepSize, 0], ArrowUp: [0, stepSize], ArrowDown: [0, -stepSize] }[event.key]
                if (!delta) return
                event.preventDefault()
                setPreviewView((current) => ({ ...current, x: current.x + delta[0], y: current.y + delta[1] }))
              }}
              onPointerDown={(event) => {
                if (event.pointerType === 'mouse' && event.button !== 0) return
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                previewDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: previewView.x, offsetY: previewView.y }
              }}
              onPointerMove={(event) => {
                const drag = previewDragRef.current
                if (!drag || drag.pointerId !== event.pointerId) return
                setPreviewView((current) => ({ ...current, x: drag.offsetX + event.clientX - drag.x, y: drag.offsetY + event.clientY - drag.y }))
              }}
              onPointerUp={(event) => { if (previewDragRef.current?.pointerId === event.pointerId) previewDragRef.current = null }}
              onPointerCancel={(event) => { if (previewDragRef.current?.pointerId === event.pointerId) previewDragRef.current = null }}
            >
              <div className="preview-modal-transform" style={{ transform: `translate(${previewView.x}px, ${previewView.y}px) scale(${previewView.zoom})` }}>
                {editorPanelTab === 'background'
                  ? <CollagePreview session={session} settings={collageSettings} />
                  : <StripPreview session={session} />}
              </div>
            </div>
            <p>Dùng nút +/− hoặc con lăn để zoom; kéo ảnh hay dùng phím mũi tên để di chuyển, nhấp đúp để đặt lại.</p>
          </div>
        </div>
      )}

      {photoPreviewIndex !== null && photos[photoPreviewIndex] && (
        <div className="photo-review-modal" role="dialog" aria-modal="true" aria-labelledby="photo-review-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhotoPreviewIndex(null) }}>
          <div className="photo-review-card">
            <div className="photo-review-head">
              <div><p className="eyebrow">Ảnh đã chụp</p><h2 id="photo-review-title">Khung {padFrame(photoPreviewIndex + 1)} / {padFrame(photos.length)}</h2></div>
              <button type="button" autoFocus onClick={() => setPhotoPreviewIndex(null)} aria-label="Đóng xem ảnh"><X size={18} aria-hidden="true" /></button>
            </div>
            <div className="photo-review-image"><img src={photos[photoPreviewIndex].dataUrl} alt={`Ảnh đã chụp ${photoPreviewIndex + 1}`} /></div>
            <div className="photo-review-actions">
              <button type="button" onClick={() => setPhotoPreviewIndex((current) => current === null ? null : Math.max(0, current - 1))} disabled={photoPreviewIndex === 0} aria-label="Ảnh trước"><ChevronLeft size={18} aria-hidden="true" /></button>
              <button type="button" className="retake-button" onClick={() => void enterCamera(photoPreviewIndex)}><RotateCcw size={16} aria-hidden="true" /> Chụp lại ảnh {photoPreviewIndex + 1}</button>
              <button type="button" onClick={() => setPhotoPreviewIndex((current) => current === null ? null : Math.min(photos.length - 1, current + 1))} disabled={photoPreviewIndex === photos.length - 1} aria-label="Ảnh sau"><ChevronRight size={18} aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      )}

      {motionPreviewOpen && motionClip && (
        <div className="photo-review-modal" role="dialog" aria-modal="true" aria-labelledby="motion-review-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setMotionPreviewOpen(false) }}>
          <div className="photo-review-card motion-review-card">
            <div className="photo-review-head">
              <div><p className="eyebrow">LiveGallery</p><h2 id="motion-review-title">Ảnh động từ ảnh phụ</h2></div>
              <button type="button" autoFocus onClick={() => setMotionPreviewOpen(false)} aria-label="Đóng xem ảnh động"><X size={18} aria-hidden="true" /></button>
            </div>
            <div className="photo-review-image"><img src={motionClip.gifUrl} alt="Ảnh động từ các ảnh phụ" /></div>
            <div className="motion-review-actions">
              {motionClip.videoBlob && <button type="button" onClick={() => downloadMotionBlob(motionClip.videoBlob!, 'webm')}><Download size={16} aria-hidden="true" /> Tải Video</button>}
              <button type="button" onClick={() => downloadMotionBlob(motionClip.gifBlob, 'gif')}><Download size={16} aria-hidden="true" /> Tải GIF</button>
            </div>
          </div>
        </div>
      )}

      {galleryShareOpen && galleryShare && (
        <div className="gallery-share-modal" role="dialog" aria-modal="true" aria-labelledby="gallery-share-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setGalleryShareOpen(false) }}>
          <div className="gallery-share-card">
            <button type="button" className="gallery-share-close" autoFocus onClick={() => setGalleryShareOpen(false)} aria-label="Đóng mã QR"><X size={18} aria-hidden="true" /></button>
            <p className="eyebrow">LiveGallery đã sẵn sàng</p>
            <h2 id="gallery-share-title">Quét để xem toàn bộ khoảnh khắc</h2>
            <img className="gallery-qr" src={galleryShare.qrDataUrl} alt={`Mã QR album ${galleryShare.shareCode}`} />
            <span className="gallery-code-label">Mã album</span>
            <button type="button" className="gallery-code" onClick={() => void copyGalleryCode()} title="Sao chép mã album">
              <span>{galleryShare.shareCode.toUpperCase()}</span>
              <Copy size={16} aria-hidden="true" />
            </button>
            <p>Nhập mã này tại <strong>livegallery.nhtisitmo.workers.dev</strong> hoặc quét QR trên điện thoại.</p>
            <a className="primary-button gallery-open-link" href={galleryShare.url} target="_blank" rel="noreferrer">
              <Eye size={17} aria-hidden="true" /> Mở LiveGallery
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
