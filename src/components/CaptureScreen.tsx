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
import { localizeBoothError } from '../i18n/core'
import { useLocale } from '../i18n/useLocale'
import { padFrame } from '../lib/boothUtils'
import type { BoothLayout, CapturedPhoto, FlashMode } from '../types'
import { ViewfinderBrackets } from './Topbar'

type CameraHandle = ReturnType<typeof useCamera>

interface CaptureScreenProps {
  camera: CameraHandle
  layout: BoothLayout
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
  const { locale, messages } = useLocale()
  const layoutName = messages.layouts[layout.id].name

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
              <p>
                {camera.loading
                  ? messages.capture.openingCamera
                  : camera.error
                    ? localizeBoothError(camera.error, locale)
                    : messages.capture.cameraOff}
              </p>
              {!camera.loading && (
                <button type="button" onClick={() => void camera.start()}>{messages.capture.retry}</button>
              )}
            </div>
          )}
          {countdown !== null && (
            <div className="countdown">
              <span>{countdown}</span>
              <small>{motionPhase === 'recording' ? messages.capture.recordingLiveBadge : messages.capture.countdownPrompt}</small>
            </div>
          )}
          {motionPhase === 'encoding' && (
            <div className="motion-encoding">
              <LoaderCircle className="spin" aria-hidden="true" />
              <strong>{messages.capture.encodingMotion}</strong>
            </div>
          )}
          {paused && (
            <div className="pause-overlay">
              <Pause size={40} aria-hidden="true" />
              <strong>{messages.capture.pausedTitle}</strong>
              <span>{messages.capture.pausedDesc}</span>
            </div>
          )}
          {screenFlash && <div className="flash" />}
          <div className="camera-progress">
            {retakeIndex !== null
              ? messages.capture.retakeHud(padFrame(retakeIndex + 1))
              : messages.capture.frameHud(padFrame(Math.min(capturePool.length + 1, captureTarget)), padFrame(captureTarget))}
          </div>
          <div className="camera-telemetry">
            {camera.resolution
              ? `${camera.resolution.width}×${camera.resolution.height}`
              : `${layout.width}×${layout.height}`}
          </div>
        </div>

        <div className="camera-actions">
          <button type="button" className="icon-button" onClick={onToggleMirror} disabled={capturing} aria-label={messages.capture.flipAria} title={messages.capture.flipAria}>
            <FlipHorizontal2 size={18} aria-hidden="true" />
          </button>
          <button type="button" className="shutter" onClick={onStartCapture} disabled={!camera.active || capturing} aria-label={messages.capture.shutterAria}>
            <span />
          </button>
          {capturing && (
            <button type="button" className="icon-button pause-button" onClick={onTogglePause} aria-label={paused ? messages.capture.resumeAria : messages.capture.pauseAria} title={paused ? messages.capture.resumeAria : messages.capture.pauseAria}>
              {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
            </button>
          )}
          <button type="button" className="icon-button" onClick={() => void camera.switchFacing()} disabled={capturing} aria-label={messages.capture.switchCameraAria} title={messages.capture.switchCameraAria}>
            <SwitchCamera size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="camera-tools">
          {zoomMode === 'web'
            ? (
              <label>
                <ZoomIn size={15} aria-hidden="true" />
                <input aria-label={messages.capture.zoomAria} type="range" min={1} max={3} step={0.05} value={cameraTransform.zoom} onChange={(event) => onChangeZoom(Number(event.target.value))} />
                <span className="mono-value">{cameraTransform.zoom.toFixed(1)}×</span>
              </label>
            )
            : <span className="device-zoom-hint"><ZoomIn size={15} aria-hidden="true" /> {messages.capture.deviceZoomHint}</span>}
          <div className="flash-modes" role="group" aria-label={messages.capture.flashGroupAria}>
            {(['off', 'auto', 'on'] as FlashMode[]).map((mode) => (
              <button key={mode} type="button" className={flashMode === mode ? 'selected' : ''} aria-pressed={flashMode === mode} onClick={() => onSelectFlashMode(mode)} disabled={capturing}>
                {messages.capture.flashShort[mode]}
              </button>
            ))}
          </div>
        </div>
        {capturing && <button type="button" className="cancel-button" onClick={onCancelCapture}>{messages.capture.cancelCapture}</button>}
      </div>

      <aside className="capture-side">
        <div className="capture-side__head">
          <p className="eyebrow">{layoutName} · {padFrame(captureTarget)} {messages.setup.framesUnit}</p>
          <h1>{messages.capture.sideTitle}</h1>
          <p>{messages.capture.sideBaseDesc(countdownSeconds)}</p>
        </div>

        {camera.devices.length > 1 && (
          <label className="device-picker">
            <span>{messages.capture.cameraDeviceLabel}</span>
            <select value={camera.selectedDeviceId ?? ''} onChange={(event) => onSelectDevice(event.target.value)} disabled={capturing}>
              {camera.devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || messages.capture.cameraFallbackLabel(index + 1)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="zoom-source">
          <span>{messages.capture.zoomControlLabel}</span>
          <div role="group" aria-label={messages.capture.zoomControlAria}>
            <button type="button" className={zoomMode === 'web' ? 'selected' : ''} aria-pressed={zoomMode === 'web'} onClick={() => onSelectZoomMode('web')} disabled={capturing}>{messages.capture.zoomWeb}</button>
            <button type="button" className={zoomMode === 'device' ? 'selected' : ''} aria-pressed={zoomMode === 'device'} onClick={() => onSelectZoomMode('device')} disabled={capturing}>{messages.capture.zoomDevice}</button>
          </div>
        </div>

        <div className="camera-capabilities">
          <p className="camera-capability"><Zap size={14} aria-hidden="true" /> {camera.torchSupported ? messages.capture.torchSupported : messages.capture.screenFlashFallback}</p>
          {camera.resolution && <p className="camera-capability"><ImageIcon size={14} aria-hidden="true" /> <span className="mono-value">{camera.resolution.width} × {camera.resolution.height} px</span></p>}
        </div>

        <div className="contact-sheet-block">
          <div className="contact-sheet-head">
            <span>{messages.capture.contactSheetTitle}</span>
            <span className="mono-value">{padFrame(capturePool.length)} / {padFrame(captureTarget)}</span>
          </div>
          <div className={`photo-slots ${captureTarget > 4 ? 'many' : ''}`}>
            {Array.from({ length: captureTarget }, (_, index) => (
              <div key={index} className={capturePool[index] ? 'filled' : ''}>
                {capturePool[index]
                  ? <>
                      <img src={capturePool[index].dataUrl} alt={messages.capture.photoAlt(index + 1)} />
                      <em className="slot-tag">{padFrame(index + 1)}</em>
                    </>
                  : <span>{padFrame(index + 1)}</span>}
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="text-button" onClick={onBack}>
          <ChevronLeft size={17} aria-hidden="true" /> {messages.capture.back}
        </button>
      </aside>
    </section>
  )
}
