import QRCode from 'qrcode'
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CAMERA_TRANSFORM, type CameraTransform } from './cameraGeometry'
import { suggestedZoomMode, type ZoomMode } from './cameraSource'
import {
  MAX_COLLAGE_ITEMS,
  createSingleCollageItem,
  createTwoStripCollage,
  getCollageSize,
  type CollageItem,
  type CollageSettings,
} from './collage'
import {
  GalleryShareModal,
  MotionPreviewModal,
  PhotoReviewModal,
  ZoomPreviewModal,
} from './components/BoothModals'
import { CaptureScreen } from './components/CaptureScreen'
import { EditorScreen } from './components/EditorScreen'
import { SelectionScreen } from './components/SelectionScreen'
import { SetupScreen } from './components/SetupScreen'
import { NoticeStack, Topbar } from './components/Topbar'
import { getFrameSize } from './frameSize'
import { publishGalleryAlbum, type GalleryShare } from './galleryPublish'
import { useBoothCatalog } from './hooks/useBoothCatalog'
import { useCamera } from './hooks/useCamera'
import { useNotices } from './hooks/useNotices'
import { useTheme } from './hooks/useTheme'
import {
  createDefaultCollageSettings,
  getSavedCountdown,
  makeId,
  playTone,
  saveCountdown,
  wait,
} from './lib/boothUtils'
import type { LocalBackground } from './lib/localBackgrounds'
import {
  createPhotoMotionClip,
  revokeMotionClip,
  type CaptureMode,
  type MotionClip,
} from './motionCapture'
import { FALLBACK_FRAMES, LAYOUTS } from './presets'
import { composeStripBlob, downloadCollage, downloadStrip } from './rendering'
import type {
  AppStep,
  BoothFrame,
  BoothSession,
  BoothSticker,
  CapturedPhoto,
  FilterId,
  FlashMode,
  StickerAsset,
  StickerCategory,
} from './types'

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const { notices, setNotice, dismissNotice } = useNotices()
  const [step, setStep] = useState<AppStep>('setup')
  const [layout, setLayout] = useState(LAYOUTS[1])
  const [frame, setFrame] = useState<BoothFrame>(FALLBACK_FRAMES[0])
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
  const [stickerCategory, setStickerCategory] = useState<'all' | StickerCategory>('all')
  const [editorPanelTab, setEditorPanelTab] = useState<'design' | 'stickers' | 'background'>('design')
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const [collageSettings, setCollageSettings] = useState<CollageSettings>(createDefaultCollageSettings)
  const [selectedCollageItemId, setSelectedCollageItemId] = useState<string | null>('collage-main')
  const [sessionDate, setSessionDate] = useState(() => new Date())
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [exporting, setExporting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [photoPreviewIndex, setPhotoPreviewIndex] = useState<number | null>(null)
  const [motionPreviewOpen, setMotionPreviewOpen] = useState(false)
  const [publishingGallery, setPublishingGallery] = useState(false)
  const [galleryShare, setGalleryShare] = useState<(GalleryShare & { qrDataUrl: string }) | null>(null)
  const [galleryShareOpen, setGalleryShareOpen] = useState(false)
  const cancelRef = useRef(0)
  const pausedRef = useRef(false)
  const camera = useCamera()

  const handleInitialFramesLoaded = useCallback((loaded: BoothFrame[]) => {
    setFrame((current) => loaded.find((candidate) => candidate.id === current.id) ?? loaded[0])
  }, [])

  const catalog = useBoothCatalog({
    onInitialFramesLoaded: handleInitialFramesLoaded,
    onNotice: setNotice,
  })

  const cameraLabel = camera.devices.find((device) => device.deviceId === camera.selectedDeviceId)?.label ?? ''
  const zoomMode = zoomModeOverride ?? suggestedZoomMode(cameraLabel)
  const outputSize = editorPanelTab === 'background' ? getCollageSize(collageSettings.format) : getFrameSize(layout, frame)

  useEffect(() => {
    saveCountdown(countdownSeconds)
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

  const visibleFrames = useMemo(
    () => catalog.frames.filter((item) => !item.layoutId || item.layoutId === layout.id),
    [catalog.frames, layout.id],
  )
  const visibleStickerAssets = useMemo(
    () => catalog.stickerAssets.filter((item) => item.category !== 'text' && item.category !== 'shapes' && (stickerCategory === 'all' || item.category === stickerCategory)),
    [catalog.stickerAssets, stickerCategory],
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
    setCollageSettings(createDefaultCollageSettings())
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
      x: Math.min(0.72, 0.18 + offset), y: Math.min(0.72, 0.14 + offset), size: 0.13, rotation: 0, flipX: false,
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
    const duplicate = {
      ...selectedSticker,
      id: makeId('sticker'),
      x: Math.min(0.94, selectedSticker.x + 0.04),
      y: Math.min(0.94, selectedSticker.y + 0.04),
      zIndex: stickers.length + 1,
    }
    setStickers((current) => [...current, duplicate])
    setSelectedStickerId(duplicate.id)
  }

  const removeSelectedSticker = () => {
    if (!selectedStickerId) return
    removeSticker(selectedStickerId)
  }

  const patchCollage = (changes: Partial<CollageSettings>) => {
    setCollageSettings((current) => ({ ...current, ...changes }))
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

  const handleAddLocalFrame = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const added = await catalog.addLocalFrame(file, layout)
    if (added) setFrame(added)
  }

  const handleRemoveLocalFrame = async (item: BoothFrame) => {
    await catalog.removeLocalFrame(item)
    if (frame.id === item.id) setFrame(FALLBACK_FRAMES[0])
  }

  const handleAddLocalBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const added = await catalog.addLocalBackground(file)
    if (added) setCollageSettings((current) => ({ ...current, backgroundImageUrl: added.url }))
  }

  const handleRemoveLocalBackground = async (item: LocalBackground) => {
    await catalog.removeLocalBackground(item)
    setCollageSettings((current) => current.backgroundImageUrl === item.url ? { ...current, backgroundImageUrl: undefined } : current)
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

  return (
    <div className="app-shell">
      <Topbar
        step={step}
        captureMode={captureMode}
        theme={theme}
        onReset={reset}
        onToggleTheme={toggleTheme}
      />

      <NoticeStack notices={notices} onDismiss={dismissNotice} />

      <main className="booth-main">
        {step === 'setup' && (
          <SetupScreen
            layout={layout}
            captureMode={captureMode}
            captureTarget={captureTarget}
            countdownSeconds={countdownSeconds}
            sound={sound}
            flashMode={flashMode}
            onSelectLayout={setLayout}
            onSelectCaptureMode={setCaptureMode}
            onChangeCountdown={setCountdownSeconds}
            onToggleSound={() => setSound((value) => !value)}
            onSelectFlashMode={setFlashMode}
            onStartCamera={() => void enterCamera()}
          />
        )}

        {step === 'capture' && (
          <CaptureScreen
            camera={camera}
            layout={layout}
            captureMode={captureMode}
            capturePool={capturePool}
            captureTarget={captureTarget}
            retakeIndex={retakeIndex}
            countdownSeconds={countdownSeconds}
            countdown={countdown}
            capturing={capturing}
            paused={paused}
            mirror={mirror}
            screenFlash={screenFlash}
            flashMode={flashMode}
            motionPhase={motionPhase}
            zoomMode={zoomMode}
            cameraTransform={cameraTransform}
            onToggleMirror={() => setMirror((value) => !value)}
            onStartCapture={() => void startCapture()}
            onTogglePause={togglePause}
            onCancelCapture={cancelCapture}
            onSelectFlashMode={setFlashMode}
            onChangeZoom={(zoom) => setCameraTransform((current) => ({ ...current, zoom }))}
            onSelectZoomMode={(mode) => {
              setZoomModeOverride(mode)
              setCameraTransform(DEFAULT_CAMERA_TRANSFORM)
            }}
            onSelectDevice={(deviceId) => {
              setCameraTransform(DEFAULT_CAMERA_TRANSFORM)
              setZoomModeOverride(null)
              void camera.selectDevice(deviceId)
            }}
            onBack={() => {
              camera.stop()
              setStep(capturePool.length === captureTarget ? (captureMode === 'photo-gallery' ? 'select' : 'edit') : 'setup')
            }}
          />
        )}

        {step === 'select' && (
          <SelectionScreen
            layout={layout}
            candidatePhotos={candidatePhotos}
            selectedCandidateIds={selectedCandidateIds}
            preparingSelection={preparingSelection}
            onToggleCandidate={toggleCandidate}
            onRetakeAll={() => {
              setCandidatePhotos([])
              setSelectedCandidateIds([])
              void enterCamera()
            }}
            onConfirmSelection={() => void confirmPhotoSelection()}
          />
        )}

        {step === 'edit' && (
          <EditorScreen
            session={session}
            editorPanelTab={editorPanelTab}
            outputSize={outputSize}
            photos={photos}
            candidatePhotos={candidatePhotos}
            captureMode={captureMode}
            motionClip={motionClip}
            visibleFrames={visibleFrames}
            remoteFrames={catalog.remoteFrames}
            filter={filter}
            frame={frame}
            caption={caption}
            showDate={showDate}
            stickers={stickers}
            selectedSticker={selectedSticker}
            selectedStickerId={selectedStickerId}
            stickerCategory={stickerCategory}
            visibleStickerAssets={visibleStickerAssets}
            remoteStickers={catalog.remoteStickers}
            collageSettings={collageSettings}
            selectedCollageItem={selectedCollageItem}
            selectedCollageItemId={selectedCollageItemId}
            remoteBackgrounds={catalog.remoteBackgrounds}
            localBackgrounds={catalog.localBackgrounds}
            remoteBackgroundSource={catalog.remoteBackgroundSource}
            format={format}
            exporting={exporting}
            publishingGallery={publishingGallery}
            galleryShare={galleryShare}
            onReset={reset}
            onOpenPreview={() => setPreviewOpen(true)}
            onOpenPhotoPreview={setPhotoPreviewIndex}
            onOpenMotionPreview={() => setMotionPreviewOpen(true)}
            onOpenGalleryShare={() => setGalleryShareOpen(true)}
            onSelectFilter={setFilter}
            onSelectFrame={setFrame}
            onAddLocalFrame={(event) => void handleAddLocalFrame(event)}
            onRemoveLocalFrame={(item) => void handleRemoveLocalFrame(item)}
            onChangeCaption={setCaption}
            onToggleShowDate={setShowDate}
            onSelectStickerCategory={setStickerCategory}
            onAddSticker={addSticker}
            onMoveSticker={moveSticker}
            onUpdateSticker={updateSticker}
            onRemoveSticker={removeSticker}
            onSelectSticker={setSelectedStickerId}
            onUpdateSelectedSticker={updateSelectedSticker}
            onDuplicateSelectedSticker={duplicateSelectedSticker}
            onRemoveSelectedSticker={removeSelectedSticker}
            onClearStickers={() => {
              setStickers([])
              setSelectedStickerId(null)
            }}
            onPatchCollage={patchCollage}
            onSelectCollageItem={setSelectedCollageItemId}
            onMoveCollageItem={moveCollageItem}
            onUpdateCollageItem={updateCollageItem}
            onRemoveCollageItem={removeCollageItem}
            onDuplicateCollageItem={duplicateCollageItem}
            onUseSingleCollage={useSingleCollage}
            onUseTwoStripCollage={useTwoStripCollage}
            onAddLocalBackground={(event) => void handleAddLocalBackground(event)}
            onRemoveLocalBackground={(item) => void handleRemoveLocalBackground(item)}
            onSelectFormat={setFormat}
            onPublishGallery={() => void publishLiveGallery()}
            onExportPhoto={() => void exportPhoto()}
          />
        )}
      </main>

      {previewOpen && (
        <ZoomPreviewModal
          session={session}
          collageSettings={collageSettings}
          isBackgroundMode={editorPanelTab === 'background'}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {photoPreviewIndex !== null && photos[photoPreviewIndex] && (
        <PhotoReviewModal
          photos={photos}
          index={photoPreviewIndex}
          onChangeIndex={setPhotoPreviewIndex}
          onRetake={(index) => void enterCamera(index)}
          onClose={() => setPhotoPreviewIndex(null)}
        />
      )}

      {motionPreviewOpen && motionClip && (
        <MotionPreviewModal
          motionClip={motionClip}
          onClose={() => setMotionPreviewOpen(false)}
        />
      )}

      {galleryShareOpen && galleryShare && (
        <GalleryShareModal
          galleryShare={galleryShare}
          onCopyCode={() => void copyGalleryCode()}
          onClose={() => setGalleryShareOpen(false)}
        />
      )}
    </div>
  )
}
