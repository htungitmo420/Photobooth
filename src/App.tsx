import {
  Camera, Check, ChevronLeft, Download, FlipHorizontal2, Image as ImageIcon,
  LoaderCircle, RefreshCcw, RotateCcw, ShieldCheck, Sparkles, SwitchCamera, Volume2, VolumeX,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StripPreview } from './components/StripPreview'
import { useCamera } from './hooks/useCamera'
import { loadFrames } from './lib/frames'
import { FILTERS, FALLBACK_FRAMES, LAYOUTS, STICKER_CHOICES } from './presets'
import { downloadStrip } from './rendering'
import type { AppStep, BoothFrame, BoothSession, BoothSticker, CapturedPhoto, FilterId } from './types'

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  const [countdownSeconds, setCountdownSeconds] = useState(3)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [mirror, setMirror] = useState(true)
  const [sound, setSound] = useState(false)
  const [flash, setFlash] = useState(false)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterId>('original')
  const [caption, setCaption] = useState('KHOẢNH KHẮC')
  const [showDate, setShowDate] = useState(true)
  const [stickers, setStickers] = useState<BoothSticker[]>([])
  const [sessionDate, setSessionDate] = useState(() => new Date())
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const cancelRef = useRef(0)
  const camera = useCamera()

  useEffect(() => {
    loadFrames().then(({ frames: loaded, remote }) => {
      setFrames(loaded)
      setFrame((current) => loaded.find((candidate) => candidate.id === current.id) ?? loaded[0])
      setRemoteFrames(remote)
    })
  }, [])

  useEffect(() => {
    if (camera.facing === 'environment') setMirror(false)
  }, [camera.facing])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && step === 'capture') {
        cancelRef.current += 1
        setCapturing(false)
        setCountdown(null)
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
    const dataUrl = camera.capture(mirror)
    if (!dataUrl) throw new Error('Camera chưa sẵn sàng. Hãy thử lại.')
    playTone(sound, 260)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 220)
    return { id: makeId('photo'), dataUrl } satisfies CapturedPhoto
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
    setStep('setup')
  }

  const addSticker = (emoji: string) => {
    if (stickers.length >= 6) {
      setNotice('Mỗi bộ ảnh dùng tối đa 6 sticker.')
      return
    }
    const offset = stickers.length * 0.055
    setStickers((current) => [...current, { id: makeId('sticker'), emoji, x: 0.18 + offset, y: 0.14 + offset, size: 0.075 }])
  }

  const moveSticker = (id: string, x: number, y: number) => {
    setStickers((current) => current.map((item) => item.id === id ? { ...item, x, y } : item))
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
              <label>Đếm ngược<select value={countdownSeconds} onChange={(event) => setCountdownSeconds(Number(event.target.value))}><option value={3}>3 giây</option><option value={5}>5 giây</option></select></label>
              <button className={sound ? 'toggle active' : 'toggle'} onClick={() => setSound((value) => !value)}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />} Âm chụp</button>
            </div>
            <button className="primary-button" onClick={() => enterCamera()}><Camera size={20} /> Bật camera</button>
            <p className="permission-copy">Trình duyệt sẽ hỏi quyền camera. Photobooth không dùng microphone.</p>
          </div>
        </section>
      )}

      {step === 'capture' && (
        <section className="capture-layout">
          <div className="camera-card">
            <div className="camera-stage">
              <video ref={camera.videoRef} muted playsInline style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />
              {!camera.active && <div className="camera-placeholder">{camera.loading ? <LoaderCircle className="spin" /> : <Camera />}<p>{camera.loading ? 'Đang mở camera…' : camera.error ?? 'Camera đang tắt'}</p>{!camera.loading && <button onClick={() => camera.start()}>Thử lại</button>}</div>}
              {countdown !== null && <div className="countdown"><span>{countdown}</span><small>Chuẩn bị nhé!</small></div>}
              {flash && <div className="flash" />}
              <div className="camera-progress">{retakeIndex !== null ? `Chụp lại ảnh ${retakeIndex + 1}` : `Ảnh ${Math.min(photos.length + 1, layout.slots)} / ${layout.slots}`}</div>
            </div>
            <div className="camera-actions">
              <button className="icon-button" onClick={() => setMirror((value) => !value)} disabled={capturing} aria-label="Lật ảnh"><FlipHorizontal2 /></button>
              <button className="shutter" onClick={startCapture} disabled={!camera.active || capturing} aria-label="Bắt đầu chụp"><span /></button>
              <button className="icon-button" onClick={() => camera.switchFacing()} disabled={capturing} aria-label="Đổi camera"><SwitchCamera /></button>
            </div>
            {capturing && <button className="cancel-button" onClick={cancelCapture}>Hủy chuỗi chụp</button>}
          </div>
          <aside className="capture-side">
            <p className="eyebrow">{layout.name}</p>
            <h2>Đổi dáng sau mỗi tiếng bíp</h2>
            <p>Mỗi ảnh có {countdownSeconds} giây chuẩn bị. Giữ camera ngang tầm mắt để khung hình tự nhiên hơn.</p>
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
            <StripPreview session={session} interactive onMoveSticker={moveSticker} />
            <div className="retake-row">
              {photos.map((photo, index) => <button key={photo.id} onClick={() => enterCamera(index)}><img src={photo.dataUrl} alt="" /><span><RotateCcw size={13} /> Ảnh {index + 1}</span></button>)}
            </div>
          </div>

          <div className="editor-panel">
            <div className="editor-title"><div><p className="eyebrow">Bước cuối</p><h1>Thêm chút dấu ấn</h1></div><Sparkles /></div>

            <section className="control-section"><h3>Bộ lọc</h3><div className="filter-grid">{FILTERS.map((item) => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}><span style={{ filter: item.css }} /><small>{item.name}</small></button>)}</div></section>

            <section className="control-section"><div className="section-line"><h3>Khung ảnh</h3><span className={remoteFrames ? 'source online' : 'source'}>{remoteFrames ? 'Supabase' : 'Bản mẫu'}</span></div><div className="frame-grid">{frames.map((item) => <button title={item.description} key={item.id} className={frame.id === item.id ? 'selected' : ''} onClick={() => setFrame(item)}><i style={{ background: item.config.background, borderColor: item.config.accent }} />{item.name}</button>)}</div></section>

            <section className="control-section"><h3>Lời nhắn</h3><div className="caption-field"><input value={caption} maxLength={60} onChange={(event) => setCaption(event.target.value)} placeholder="KHOẢNH KHẮC" /><span>{caption.length}/60</span></div><label className="check-line"><input type="checkbox" checked={showDate} onChange={(event) => setShowDate(event.target.checked)} /> Hiện ngày chụp</label></section>

            <section className="control-section"><div className="section-line"><h3>Sticker</h3><span>{stickers.length}/6</span></div><div className="sticker-grid">{STICKER_CHOICES.map((emoji) => <button key={emoji} onClick={() => addSticker(emoji)}>{emoji}</button>)}{stickers.length > 0 && <button className="clear-stickers" onClick={() => setStickers([])}>Xóa</button>}</div><p className="hint">Kéo sticker trực tiếp trên bản ảnh để đổi vị trí.</p></section>

            <section className="download-card"><div><ImageIcon /><span><strong>{layout.width} × {layout.height} px</strong><small>Ảnh chất lượng cao</small></span></div><div className="format-switch"><button className={format === 'png' ? 'selected' : ''} onClick={() => setFormat('png')}>PNG</button><button className={format === 'jpeg' ? 'selected' : ''} onClick={() => setFormat('jpeg')}>JPG</button></div><button className="primary-button" onClick={exportPhoto} disabled={exporting}>{exporting ? <LoaderCircle className="spin" /> : <Download />} {exporting ? 'Đang tạo ảnh…' : 'Tải ảnh về'}</button></section>

            <button className="text-button centered" onClick={reset}><RefreshCcw size={16} /> Chụp bộ mới</button>
          </div>
        </section>
      )}
    </main>
  )
}
