import {
  Camera,
  ChevronLeft,
  FlipHorizontal2,
  Image as ImageIcon,
  LoaderCircle,
  Pause,
  Play,
  SwitchCamera,
  Zap,
  ZoomIn,
} from 'lucide-react'
import type { CameraTransform } from '../cameraGeometry'
import type { ZoomMode } from '../cameraSource'
import type { useCamera } from '../hooks/useCamera'
import { padFrame } from '../lib/boothUtils'
import type { CaptureMode } from '../motionCapture'
import type { BoothLayout, CapturedPhoto, FlashMode } from '../types'
import { ViewfinderBrackets } from './Topbar'

type CameraHandle = ReturnType<typeof useCamera>

interface CaptureScreenProps {
  camera: CameraHandle
  layout: BoothLayout
  captureMode: CaptureMode
  capturePool: CapturedPhoto[]
  captureTarget: number
  retakeIndex: number | null
  countdownSeconds: number
  countdown: number | null
  capturing: boolean
  paused: boolean
  mirror: boolean
  screenFlash: boolean
  flashMode: FlashMode
  motionPhase: 'idle' | 'countdown' | 'recording' | 'encoding'
  zoomMode: ZoomMode
  cameraTransform: CameraTransform
  onToggleMirror: () => void
  onStartCapture: () => void
  onTogglePause: () => void
  onCancelCapture: () => void
  onSelectFlashMode: (mode: FlashMode) => void
  onChangeZoom: (zoom: number) => void
  onSelectZoomMode: (mode: ZoomMode) => void
  onSelectDevice: (deviceId: string) => void
  onBack: () => void
}

export function CaptureScreen({
  camera,
  layout,
  captureMode,
  capturePool,
  captureTarget,
  retakeIndex,
  countdownSeconds,
  countdown,
  capturing,
  paused,
  mirror,
  screenFlash,
  flashMode,
  motionPhase,
  zoomMode,
  cameraTransform,
  onToggleMirror,
  onStartCapture,
  onTogglePause,
  onCancelCapture,
  onSelectFlashMode,
  onChangeZoom,
  onSelectZoomMode,
  onSelectDevice,
  onBack,
}: CaptureScreenProps) {
  return (
    <section className="capture-layout">
      <div className="camera-card">
        <div className="camera-stage">
          <ViewfinderBrackets />

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
          <button type="button" className="icon-button" onClick={onToggleMirror} disabled={capturing} aria-label="Lật ảnh" title="Lật ảnh">
            <FlipHorizontal2 size={18} aria-hidden="true" />
          </button>
          <button type="button" className="shutter" onClick={onStartCapture} disabled={!camera.active || capturing} aria-label="Bắt đầu chụp">
            <span />
          </button>
          {capturing && (
            <button type="button" className="icon-button pause-button" onClick={onTogglePause} aria-label={paused ? 'Tiếp tục chụp' : 'Tạm dừng chụp'} title={paused ? 'Tiếp tục chụp' : 'Tạm dừng chụp'}>
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
                <input aria-label="Zoom camera" type="range" min={1} max={3} step={0.05} value={cameraTransform.zoom} onChange={(event) => onChangeZoom(Number(event.target.value))} />
                <span className="mono-value">{cameraTransform.zoom.toFixed(1)}×</span>
              </label>
            )
            : <span className="device-zoom-hint"><ZoomIn size={15} aria-hidden="true" /> Zoom trực tiếp trên máy ảnh</span>}
          <div className="flash-modes" role="group" aria-label="Đèn flash">
            {(['off', 'auto', 'on'] as FlashMode[]).map((mode) => (
              <button key={mode} type="button" className={flashMode === mode ? 'selected' : ''} aria-pressed={flashMode === mode} onClick={() => onSelectFlashMode(mode)} disabled={capturing}>
                {mode === 'off' ? 'Tắt' : mode === 'auto' ? 'Auto' : 'Bật'}
              </button>
            ))}
          </div>
        </div>
        {capturing && <button type="button" className="cancel-button" onClick={onCancelCapture}>Hủy chuỗi chụp</button>}
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
            <select value={camera.selectedDeviceId ?? ''} onChange={(event) => onSelectDevice(event.target.value)} disabled={capturing}>
              {camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
            </select>
          </label>
        )}

        <div className="zoom-source">
          <span>Điều khiển zoom</span>
          <div role="group" aria-label="Cách điều khiển zoom">
            <button type="button" className={zoomMode === 'web' ? 'selected' : ''} aria-pressed={zoomMode === 'web'} onClick={() => onSelectZoomMode('web')} disabled={capturing}>Trong web</button>
            <button type="button" className={zoomMode === 'device' ? 'selected' : ''} aria-pressed={zoomMode === 'device'} onClick={() => onSelectZoomMode('device')} disabled={capturing}>Trên máy ảnh</button>
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

        <button type="button" className="text-button" onClick={onBack}>
          <ChevronLeft size={17} aria-hidden="true" /> Quay lại
        </button>
      </aside>
    </section>
  )
}
