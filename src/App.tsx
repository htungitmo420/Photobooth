import {
  Camera, Check, ChevronLeft, Copy, Download, FlipHorizontal2, Image as ImageIcon,
  Layers, LoaderCircle, Plus, RefreshCcw, RotateCcw, RotateCw, ShieldCheck, Sparkles,
  SwitchCamera, Trash2, Volume2, VolumeX, X, Zap, ZoomIn,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CAMERA_TRANSFORM, type CameraTransform } from './cameraGeometry'
import { StripPreview } from './components/StripPreview'
import { useCamera } from './hooks/useCamera'
import { loadFrames } from './lib/frames'
import { deleteLocalFrame, loadLocalFrames, revokeFrameUrls, saveLocalFrame } from './lib/localFrames'
import { loadStickers } from './lib/stickers'
import { FILTERS, FALLBACK_FRAMES, FALLBACK_STICKERS, LAYOUTS, STICKER_CATEGORIES } from './presets'
import { downloadStrip } from './rendering'
import type { AppStep, BoothFrame, BoothSession, BoothSticker, CapturedPhoto, FilterId, FlashMode, StickerAsset, StickerCategory } from './types'

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  const [step, setStep] = useState<AppStep>('setup')
  const [layout, setLayout] = useState(LAYOUTS[1])
  const [frames, setFrames] = useState<BoothFrame[]>(FALLBACK_FRAMES)
  const [frame, setFrame] = useState<BoothFrame>(FALLBACK_FRAMES[0])
  const [remoteFrames, setRemoteFrames] = useState(false)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [countdownSeconds, setCountdownSeconds] = useState(getSavedCountdown)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [mirror, setMirror] = useState(true)
  const [sound, setSound] = useState(false)
  const [screenFlash, setScreenFlash] = useState(false)
  const [flashMode, setFlashMode] = useState<FlashMode>('auto')
  const [cameraTransform, setCameraTransform] = useState<CameraTransform>(DEFAULT_CAMERA_TRANSFORM)
  const [hardwareZoom, setHardwareZoom] = useState(false)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterId>('original')
  const [caption, setCaption] = useState('KHOẢNH KHẮC')
  const [showDate, setShowDate] = useState(true)
  const [stickers, setStickers] = useState<BoothSticker[]>([])
  const [stickerAssets, setStickerAssets] = useState<StickerAsset[]>(FALLBACK_STICKERS)
  const [stickerCategory, setStickerCategory] = useState<'all' | StickerCategory>('all')
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null)
  const [remoteStickers, setRemoteStickers] = useState(false)
  const [sessionDate, setSessionDate] = useState(() => new Date())
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const cancelRef = useRef(0)
  const frameInputRef = useRef<HTMLInputElement>(null)
  const cameraDragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const camera = useCamera()

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
    try { localStorage.setItem('photobooth-countdown', String(countdownSeconds)) } catch { /* Preference storage is optional. */ }
  }, [countdownSeconds])

  useEffect(() => {
    if (camera.facing === 'environment') setMirror(false)
    setCameraTransform(DEFAULT_CAMERA_TRANSFORM)
    setHardwareZoom(false)
  }, [camera.facing])

  useEffect(() => {
    document.body.classList.toggle('editor-mode', step === 'edit')
    return () => document.body.classList.remove('editor-mode')
  }, [step])

  useEffect(() => {
    if (!previewOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewOpen])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && step === 'capture') {
        cancelRef.current += 1
        setCapturing(false)
        setCountdown(null)
        setScreenFlash(false)
        void camera.setTorch(false)
        camera.stop()
        setNotice('Phiên chụp đã tạm dừng vì bạn chuyển tab.')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [camera, step])

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
    () => stickerAssets.filter((item) => stickerCategory === 'all' || item.category === stickerCategory),
    [stickerAssets, stickerCategory],
  )
  const selectedSticker = stickers.find((item) => item.id === selectedStickerId) ?? null

  useEffect(() => {
    if (frame.layoutId && frame.layoutId !== layout.id) setFrame(FALLBACK_FRAMES[0])
  }, [frame, layout.id])

  const enterCamera = async (index: number | null = null) => {
    setNotice(null)
    setRetakeIndex(index)
    setStep('capture')
    await wait(50)
    await camera.start()
  }

  const runCountdown = async (token: number) => {
    for (let remaining = countdownSeconds; remaining > 0; remaining -= 1) {
      if (token !== cancelRef.current) return false
      setCountdown(remaining)
      playTone(sound)
      await wait(1000)
    }
    setCountdown(null)
    return token === cancelRef.current
  }

  const takeFrame = async (token: number) => {
    const ready = await runCountdown(token)
    if (!ready) return null
    const brightness = flashMode === 'auto' ? camera.measureBrightness() : null
    const needsFlash = flashMode === 'on' || (flashMode === 'auto' && brightness !== null && brightness < 0.3)
    let torchOn = false
    try {
      if (needsFlash) torchOn = await camera.setTorch(true)
      if (needsFlash && !torchOn) setScreenFlash(true)
      if (needsFlash) await wait(torchOn ? 180 : 240)
      const effectiveTransform = hardwareZoom ? { ...cameraTransform, zoom: 1 } : cameraTransform
      const dataUrl = camera.capture(mirror, effectiveTransform)
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
    setNotice(null)
    try {
      if (retakeIndex !== null) {
        const photo = await takeFrame(token)
        if (photo && token === cancelRef.current) {
          setPhotos((current) => current.map((item, index) => index === retakeIndex ? photo : item))
          camera.stop()
          setRetakeIndex(null)
          setStep('edit')
        }
        return
      }

      const nextPhotos: CapturedPhoto[] = []
      for (let index = photos.length; index < layout.slots; index += 1) {
        const photo = await takeFrame(token)
        if (!photo || token !== cancelRef.current) return
        nextPhotos.push(photo)
        setPhotos((current) => [...current, photo])
        if (index < layout.slots - 1) await wait(800)
      }
      camera.stop()
      setStep('edit')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể chụp ảnh.')
    } finally {
      if (token === cancelRef.current) {
        setCapturing(false)
        setCountdown(null)
      }
    }
  }

  const cancelCapture = () => {
    cancelRef.current += 1
    setCapturing(false)
    setCountdown(null)
    setScreenFlash(false)
    void camera.setTorch(false)
    setNotice(photos.length ? 'Đã giữ các ảnh vừa chụp. Bạn có thể chụp tiếp.' : 'Đã hủy lượt chụp.')
  }

  const reset = () => {
    cancelRef.current += 1
    camera.stop()
    setPhotos([])
    setStickers([])
    setFilter('original')
    setCaption('KHOẢNH KHẮC')
    setSessionDate(new Date())
    setRetakeIndex(null)
    setNotice(null)
    setSelectedStickerId(null)
    setCameraTransform(DEFAULT_CAMERA_TRANSFORM)
    setPreviewOpen(false)
    setStep('setup')
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

  const updateSelectedSticker = (changes: Partial<BoothSticker>) => {
    if (!selectedStickerId) return
    setStickers((current) => current.map((item) => item.id === selectedStickerId ? { ...item, ...changes } : item))
  }

  const duplicateSelectedSticker = () => {
    if (!selectedSticker || stickers.length >= 20) return
    const duplicate = { ...selectedSticker, id: makeId('sticker'), x: Math.min(.94, selectedSticker.x + .04), y: Math.min(.94, selectedSticker.y + .04), zIndex: stickers.length + 1 }
    setStickers((current) => [...current, duplicate])
    setSelectedStickerId(duplicate.id)
  }

  const removeSelectedSticker = () => {
    if (!selectedStickerId) return
    setStickers((current) => current.filter((item) => item.id !== selectedStickerId))
    setSelectedStickerId(null)
  }

  const handleZoom = async (value: number) => {
    setCameraTransform((current) => ({ ...current, zoom: value }))
    setHardwareZoom(await camera.applyHardwareZoom(value))
  }

  const handleCameraPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (capturing || !camera.active) return
    event.currentTarget.setPointerCapture(event.pointerId)
    cameraDragRef.current = { x: event.clientX, y: event.clientY, offsetX: cameraTransform.offsetX, offsetY: cameraTransform.offsetY }
  }

  const handleCameraPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cameraDragRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    setCameraTransform((current) => ({
      ...current,
      offsetX: Math.max(-1, Math.min(1, cameraDragRef.current!.offsetX - (event.clientX - cameraDragRef.current!.x) / rect.width * 2)),
      offsetY: Math.max(-1, Math.min(1, cameraDragRef.current!.offsetY - (event.clientY - cameraDragRef.current!.y) / rect.height * 2)),
    }))
  }

  const addLocalFrame = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const added = await saveLocalFrame(file, file.name.replace(/\.[^.]+$/, ''), layout.id, layout.width / layout.height)
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

  const exportPhoto = async () => {
    setExporting(true)
    setNotice(null)
    try {
      await downloadStrip(session, format)
      setNotice('Ảnh đã được tạo. Nếu chưa thấy file, hãy kiểm tra mục Tải xuống.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Xuất ảnh thất bại. Hãy thử lại.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="Về đầu">
          <span className="brand-mark"><Camera size={20} /></span>
          <span><strong>Khoảnh Khắc</strong><small>photobooth</small></span>
        </button>
        <div className="privacy-note"><ShieldCheck size={16} /> Ảnh chỉ được xử lý trên thiết bị</div>
      </header>

      <nav className="steps" aria-label="Tiến trình">
        {[
          ['setup', '01', 'Chuẩn bị'],
          ['capture', '02', 'Chụp ảnh'],
          ['edit', '03', 'Hoàn thiện'],
        ].map(([value, number, label]) => (
          <div key={value} className={`step ${step === value ? 'active' : ''} ${(['setup', 'capture', 'edit'].indexOf(step) > ['setup', 'capture', 'edit'].indexOf(value)) ? 'done' : ''}`}>
            <span>{step !== value && ['setup', 'capture', 'edit'].indexOf(step) > ['setup', 'capture', 'edit'].indexOf(value) ? <Check size={14} /> : number}</span>
            {label}
          </div>
        ))}
      </nav>

      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice(null)} aria-label="Đóng">×</button></div>}

      {step === 'setup' && (
        <section className="setup-grid">
          <div className="intro-card">
            <p className="eyebrow">Một bộ ảnh, một câu chuyện nhỏ</p>
            <h1>Sẵn sàng để lưu lại khoảnh khắc?</h1>
            <p>Chọn kiểu ảnh bạn thích. Máy ảnh sẽ tự đếm ngược để bạn có thời gian đổi dáng.</p>
            <div className="sample-strip" aria-hidden="true">
              {['●', '✦', '☺', '♥'].map((symbol, index) => <div key={index}><span>{symbol}</span></div>)}
              <strong>KHOẢNH KHẮC</strong>
            </div>
          </div>

          <div className="setup-panel">
            <div className="panel-heading"><span>1</span><div><h2>Chọn bố cục</h2><p>Bạn có thể tạo bộ mới để đổi kiểu sau.</p></div></div>
            <div className="layout-options">
              {LAYOUTS.map((item) => (
                <button key={item.id} onClick={() => setLayout(item)} className={`layout-option ${layout.id === item.id ? 'selected' : ''}`}>
                  <span className={`layout-icon ${item.kind} slots-${item.slots}`}>{Array.from({ length: item.slots }, (_, index) => <i key={index} />)}</span>
                  <span><strong>{item.name}</strong><small>{item.description}</small></span>
                  {layout.id === item.id && <Check size={18} />}
                </button>
              ))}
            </div>
            <div className="quick-settings">
              <label>Đếm ngược <span className="number-setting"><input aria-label="Số giây đếm ngược" type="number" min={0} max={30} value={countdownSeconds} onChange={(event) => setCountdownSeconds(Math.min(30, Math.max(0, Number(event.target.value))))} /> giây</span></label>
              <button className={sound ? 'toggle active' : 'toggle'} onClick={() => setSound((value) => !value)}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />} Âm chụp</button>
            </div>
            <div className="flash-setting"><span><Zap size={16} /> Flash</span><div>{(['off', 'auto', 'on'] as FlashMode[]).map((mode) => <button key={mode} className={flashMode === mode ? 'selected' : ''} onClick={() => setFlashMode(mode)}>{mode === 'off' ? 'Tắt' : mode === 'auto' ? 'Tự động' : 'Bật'}</button>)}</div></div>
            <button className="primary-button" onClick={() => enterCamera()}><Camera size={20} /> Bật camera</button>
            <p className="permission-copy">Trình duyệt sẽ hỏi quyền camera. Photobooth không dùng microphone.</p>
          </div>
        </section>
      )}

      {step === 'capture' && (
        <section className="capture-layout">
          <div className="camera-card">
            <div
              className="camera-stage"
              onPointerDown={handleCameraPointerDown}
              onPointerMove={handleCameraPointerMove}
              onPointerUp={() => { cameraDragRef.current = null }}
              onPointerCancel={() => { cameraDragRef.current = null }}
              onDoubleClick={() => setCameraTransform(DEFAULT_CAMERA_TRANSFORM)}
            >
              <video
                ref={camera.videoRef}
                muted
                playsInline
                style={{
                  transform: `${mirror ? 'scaleX(-1) ' : ''}scale(${hardwareZoom ? 1 : cameraTransform.zoom}) translate(${-cameraTransform.offsetX * 8}%, ${-cameraTransform.offsetY * 8}%)`,
                }}
              />
              {!camera.active && <div className="camera-placeholder">{camera.loading ? <LoaderCircle className="spin" /> : <Camera />}<p>{camera.loading ? 'Đang mở camera…' : camera.error ?? 'Camera đang tắt'}</p>{!camera.loading && <button onClick={() => camera.start()}>Thử lại</button>}</div>}
              {countdown !== null && <div className="countdown"><span>{countdown}</span><small>Chuẩn bị nhé!</small></div>}
              {screenFlash && <div className="flash" />}
              <div className="camera-progress">{retakeIndex !== null ? `Chụp lại ảnh ${retakeIndex + 1}` : `Ảnh ${Math.min(photos.length + 1, layout.slots)} / ${layout.slots}`}</div>
            </div>
            <div className="camera-actions">
              <button className="icon-button" onClick={() => setMirror((value) => !value)} disabled={capturing} aria-label="Lật ảnh"><FlipHorizontal2 /></button>
              <button className="shutter" onClick={startCapture} disabled={!camera.active || capturing} aria-label="Bắt đầu chụp"><span /></button>
              <button className="icon-button" onClick={() => camera.switchFacing()} disabled={capturing} aria-label="Đổi camera"><SwitchCamera /></button>
            </div>
            <div className="camera-tools">
              <label><ZoomIn size={15} /><input aria-label="Zoom camera" type="range" min={1} max={camera.zoomRange ? Math.min(3, camera.zoomRange.max) : 3} step={camera.zoomRange?.step ?? .05} value={cameraTransform.zoom} onChange={(event) => void handleZoom(Number(event.target.value))} /><span>{cameraTransform.zoom.toFixed(1)}×</span></label>
              <div className="flash-modes">{(['off', 'auto', 'on'] as FlashMode[]).map((mode) => <button key={mode} className={flashMode === mode ? 'selected' : ''} onClick={() => setFlashMode(mode)} disabled={capturing}>{mode === 'off' ? 'Tắt' : mode === 'auto' ? 'Auto' : 'Bật'}</button>)}</div>
            </div>
            {capturing && <button className="cancel-button" onClick={cancelCapture}>Hủy chuỗi chụp</button>}
          </div>
          <aside className="capture-side">
            <p className="eyebrow">{layout.name}</p>
            <h2>Đổi dáng sau mỗi tiếng bíp</h2>
            <p>Mỗi ảnh có {countdownSeconds} giây chuẩn bị. Giữ camera ngang tầm mắt để khung hình tự nhiên hơn.</p>
            {camera.devices.length > 1 && <label className="device-picker">Máy ảnh<select value={camera.selectedDeviceId ?? ''} onChange={(event) => void camera.selectDevice(event.target.value)} disabled={capturing}>{camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></label>}
            <p className="camera-capability"><Zap size={14} /> {camera.torchSupported ? 'Camera hỗ trợ đèn phần cứng' : 'Dùng flash màn hình khi cần'}</p>
            <div className="photo-slots">
              {Array.from({ length: layout.slots }, (_, index) => (
                <div key={index} className={photos[index] ? 'filled' : ''}>
                  {photos[index] ? <img src={photos[index].dataUrl} alt={`Ảnh ${index + 1}`} /> : <span>{index + 1}</span>}
                </div>
              ))}
            </div>
            <button className="text-button" onClick={() => { camera.stop(); setStep(photos.length === layout.slots ? 'edit' : 'setup') }}><ChevronLeft size={17} /> Quay lại</button>
          </aside>
        </section>
      )}

      {step === 'edit' && (
        <section className="editor-layout">
          <div className="preview-column">
            <p className="eyebrow">Bản ảnh của bạn</p>
            <div className="preview-stage">
              <StripPreview session={session} interactive onMoveSticker={moveSticker} selectedStickerId={selectedStickerId} onSelectSticker={setSelectedStickerId} onPreview={() => setPreviewOpen(true)} />
            </div>
            <div className="retake-row">
              {photos.map((photo, index) => <button key={photo.id} onClick={() => enterCamera(index)}><img src={photo.dataUrl} alt="" /><span><RotateCcw size={13} /> Ảnh {index + 1}</span></button>)}
            </div>
          </div>

          <div className="editor-panel">
            <div className="editor-title"><div><p className="eyebrow">Bước cuối</p><h1>Thêm chút dấu ấn</h1></div><Sparkles /></div>

            <section className="control-section"><h3>Bộ lọc</h3><div className="filter-grid">{FILTERS.map((item) => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}><span style={{ filter: item.css }} /><small>{item.name}</small></button>)}</div></section>

            <section className="control-section">
              <div className="section-line"><h3>Khung ảnh</h3><span className={remoteFrames ? 'source online' : 'source'}>{remoteFrames ? 'Supabase + máy' : 'Bản mẫu + máy'}</span></div>
              <div className="frame-grid">
                {visibleFrames.map((item) => <div className="frame-option" key={item.id}><button title={item.description} className={frame.id === item.id ? 'selected' : ''} onClick={() => setFrame(item)}>{item.assetUrl ? <img src={item.assetUrl} alt="" /> : <i style={{ background: item.config.background, borderColor: item.config.accent }} />}{item.name}</button>{item.source === 'local' && <button className="delete-frame" onClick={() => void removeLocalFrame(item)} aria-label={`Xóa ${item.name}`}><Trash2 size={13} /></button>}</div>)}
                <button className="add-frame" onClick={() => frameInputRef.current?.click()}><Plus size={17} /> Thêm frame</button>
              </div>
              <input ref={frameInputRef} className="visually-hidden" type="file" accept="image/png,image/webp" onChange={addLocalFrame} />
              <p className="hint">PNG/WebP tối đa 5 MB, đúng tỷ lệ bố cục hiện tại. Frame được lưu riêng trong trình duyệt này.</p>
            </section>

            <section className="control-section"><h3>Lời nhắn</h3><div className="caption-field"><input value={caption} maxLength={60} onChange={(event) => setCaption(event.target.value)} placeholder="KHOẢNH KHẮC" /><span>{caption.length}/60</span></div><label className="check-line"><input type="checkbox" checked={showDate} onChange={(event) => setShowDate(event.target.checked)} /> Hiện ngày chụp</label></section>

            <section className="control-section sticker-section">
              <div className="section-line"><h3>Sticker</h3><span>{stickers.length}/20 · {remoteStickers ? 'Supabase' : 'Có sẵn'}</span></div>
              <div className="sticker-categories">{STICKER_CATEGORIES.map((category) => <button key={category.id} className={stickerCategory === category.id ? 'selected' : ''} onClick={() => setStickerCategory(category.id)}>{category.name}</button>)}</div>
              <div className="sticker-library">{visibleStickerAssets.map((asset) => <button className={asset.category === 'text' ? 'text-sticker' : ''} key={asset.id} onClick={() => addSticker(asset)} title={asset.name}>{asset.kind === 'image' ? <img src={asset.content} alt={asset.name} loading="lazy" /> : <span>{asset.content}</span>}</button>)}</div>
              {selectedSticker && <div className="sticker-tools">
                <label>Kích thước<input type="range" min={.07} max={.3} step={.01} value={selectedSticker.size} onChange={(event) => updateSelectedSticker({ size: Number(event.target.value) })} /></label>
                <button onClick={() => updateSelectedSticker({ rotation: selectedSticker.rotation + 15 })} title="Xoay"><RotateCw size={16} /></button>
                <button onClick={() => updateSelectedSticker({ flipX: !selectedSticker.flipX })} title="Lật ngang"><FlipHorizontal2 size={16} /></button>
                <button onClick={() => updateSelectedSticker({ zIndex: stickers.length + 1 })} title="Đưa lên trước"><Layers size={16} /></button>
                <button onClick={duplicateSelectedSticker} title="Nhân bản"><Copy size={16} /></button>
                <button onClick={removeSelectedSticker} title="Xóa"><Trash2 size={16} /></button>
              </div>}
              <div className="sticker-footer"><p className="hint">Chạm để thêm, kéo trực tiếp trên ảnh. Dùng phím mũi tên để căn chính xác.</p>{stickers.length > 0 && <button onClick={() => { setStickers([]); setSelectedStickerId(null) }}>Xóa tất cả</button>}</div>
            </section>

            <section className="download-card"><div><ImageIcon /><span><strong>{layout.width} × {layout.height} px</strong><small>Ảnh chất lượng cao</small></span></div><div className="format-switch"><button className={format === 'png' ? 'selected' : ''} onClick={() => setFormat('png')}>PNG</button><button className={format === 'jpeg' ? 'selected' : ''} onClick={() => setFormat('jpeg')}>JPG</button></div><button className="primary-button" onClick={exportPhoto} disabled={exporting}>{exporting ? <LoaderCircle className="spin" /> : <Download />} {exporting ? 'Đang tạo ảnh…' : 'Tải ảnh về'}</button></section>

            <button className="text-button centered" onClick={reset}><RefreshCcw size={16} /> Chụp bộ mới</button>
          </div>
        </section>
      )}

      {previewOpen && (
        <div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false) }}>
          <div className="preview-modal-card">
            <div className="preview-modal-head"><div><p className="eyebrow">Bản hoàn chỉnh</p><h2 id="preview-title">Xem trước ảnh photobooth</h2></div><button autoFocus onClick={() => setPreviewOpen(false)} aria-label="Đóng xem trước"><X /></button></div>
            <div className="preview-modal-image"><StripPreview session={session} /></div>
            <p>Đây là bố cục sẽ được dùng khi tải PNG/JPG.</p>
          </div>
        </div>
      )}
    </main>
  )
}
