import { Camera, Check, Image as ImageIcon, Video, Volume2, VolumeX, Zap } from 'lucide-react'
import { clampCountdown, padFrame } from '../lib/boothUtils'
import type { CaptureMode } from '../motionCapture'
import { LAYOUTS } from '../presets'
import type { BoothLayout, FlashMode } from '../types'
import { ViewfinderBrackets } from './Topbar'

interface SetupScreenProps {
  layout: BoothLayout
  captureMode: CaptureMode
  captureTarget: number
  countdownSeconds: number
  sound: boolean
  flashMode: FlashMode
  onSelectLayout: (layout: BoothLayout) => void
  onSelectCaptureMode: (mode: CaptureMode) => void
  onChangeCountdown: (seconds: number) => void
  onToggleSound: () => void
  onSelectFlashMode: (mode: FlashMode) => void
  onStartCamera: () => void
}

export function SetupScreen({
  layout,
  captureMode,
  captureTarget,
  countdownSeconds,
  sound,
  flashMode,
  onSelectLayout,
  onSelectCaptureMode,
  onChangeCountdown,
  onToggleSound,
  onSelectFlashMode,
  onStartCamera,
}: SetupScreenProps) {
  const specimenFrames = Array.from({ length: layout.slots }, (_, index) => padFrame(index + 1))

  return (
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
          <ViewfinderBrackets />

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
                onClick={() => onSelectLayout(item)}
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
              onClick={() => onSelectCaptureMode('photo')}
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
              onClick={() => onSelectCaptureMode('photo-gallery')}
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
                onChange={(event) => onChangeCountdown(clampCountdown(Number(event.target.value)))}
              />
              <span className="unit">giây</span>
            </span>
          </label>
          <button
            type="button"
            className={sound ? 'toggle active' : 'toggle'}
            aria-pressed={sound}
            onClick={onToggleSound}
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
                onClick={() => onSelectFlashMode(mode)}
              >
                {mode === 'off' ? 'Tắt' : mode === 'auto' ? 'Tự động' : 'Bật'}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="primary-button shutter-cta" onClick={onStartCamera}>
          <Camera size={19} aria-hidden="true" />
          <span>Bật camera</span>
        </button>
        <p className="permission-copy">Trình duyệt sẽ hỏi quyền camera. Photobooth không dùng microphone.</p>
      </div>
    </section>
  )
}
