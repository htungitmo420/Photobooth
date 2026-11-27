import { ChevronLeft, ChevronRight, Copy, Download, Eye, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CollageSettings } from '../collage'
import type { GalleryShare } from '../galleryPublish'
import { useLocale } from '../i18n/useLocale'
import { formatShareHost, padFrame } from '../lib/boothUtils'
import { downloadMotionBlob, type MotionClip } from '../motionCapture'
import type { BoothSession, CapturedPhoto } from '../types'
import { CollagePreview } from './CollagePreview'
import { StripPreview } from './StripPreview'

export function ZoomPreviewModal({
  session,
  collageSettings,
  isBackgroundMode,
  onClose,
}: {
  session: BoothSession
  collageSettings: CollageSettings
  isBackgroundMode: boolean
  onClose: () => void
}) {
  const { messages } = useLocale()
  const [previewView, setPreviewView] = useState({ zoom: 1, x: 0, y: 0 })
  const previewDragRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  const setReviewZoom = (zoom: number) => {
    const next = Math.min(4, Math.max(0.75, zoom))
    setPreviewView((current) => ({ ...current, zoom: next }))
  }

  return (
    <div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="preview-modal-card">
        <div className="preview-modal-head">
          <div>
            <p className="eyebrow">{messages.modals.finalEyebrow}</p>
            <h2 id="preview-title">{isBackgroundMode ? messages.modals.collagePreviewTitle : messages.modals.stripPreviewTitle}</h2>
          </div>
          <div className="preview-modal-actions">
            <button type="button" onClick={() => setReviewZoom(previewView.zoom - 0.25)} disabled={previewView.zoom <= 0.75} aria-label={messages.modals.zoomOutAria}><ZoomOut size={18} aria-hidden="true" /></button>
            <output aria-live="polite">{Math.round(previewView.zoom * 100)}%</output>
            <button type="button" onClick={() => setReviewZoom(previewView.zoom + 0.25)} disabled={previewView.zoom >= 4} aria-label={messages.modals.zoomInAria}><ZoomIn size={18} aria-hidden="true" /></button>
            <button type="button" onClick={() => setPreviewView({ zoom: 1, x: 0, y: 0 })} aria-label={messages.modals.resetZoomAria}><RotateCcw size={18} aria-hidden="true" /></button>
            <button type="button" autoFocus onClick={onClose} aria-label={messages.modals.closePreviewAria}><X size={18} aria-hidden="true" /></button>
          </div>
        </div>
        <div
          className="preview-modal-image"
          tabIndex={0}
          aria-label={messages.modals.panAreaAria}
          onWheel={(event) => { event.preventDefault(); setReviewZoom(previewView.zoom + (event.deltaY < 0 ? 0.25 : -0.25)) }}
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
            {isBackgroundMode
              ? <CollagePreview session={session} settings={collageSettings} />
              : <StripPreview session={session} />}
          </div>
        </div>
        <p>{messages.modals.zoomHint}</p>
      </div>
    </div>
  )
}

export function PhotoReviewModal({
  photos,
  index,
  onChangeIndex,
  onRetake,
  onClose,
}: {
  photos: CapturedPhoto[]
  index: number
  onChangeIndex: (nextIndex: number) => void
  onRetake: (index: number) => void
  onClose: () => void
}) {
  const { messages } = useLocale()
  const photo = photos[index]
  if (!photo) return null

  return (
    <div className="photo-review-modal" role="dialog" aria-modal="true" aria-labelledby="photo-review-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="photo-review-card">
        <div className="photo-review-head">
          <div>
            <p className="eyebrow">{messages.modals.capturedPhotoEyebrow}</p>
            <h2 id="photo-review-title">{messages.modals.frameCountTitle(padFrame(index + 1), padFrame(photos.length))}</h2>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label={messages.modals.closePhotoAria}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="photo-review-image"><img src={photo.dataUrl} alt={messages.modals.capturedPhotoAlt(index + 1)} /></div>
        <div className="photo-review-actions">
          <button type="button" onClick={() => onChangeIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label={messages.modals.prevPhotoAria}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" className="retake-button" onClick={() => onRetake(index)}><RotateCcw size={16} aria-hidden="true" /> {messages.modals.retakePhoto(index + 1)}</button>
          <button type="button" onClick={() => onChangeIndex(Math.min(photos.length - 1, index + 1))} disabled={index === photos.length - 1} aria-label={messages.modals.nextPhotoAria}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  )
}

export function MotionPreviewModal({
  motionClip,
  onClose,
}: {
  motionClip: MotionClip
  onClose: () => void
}) {
  const { messages } = useLocale()
  return (
    <div className="photo-review-modal" role="dialog" aria-modal="true" aria-labelledby="motion-review-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="photo-review-card motion-review-card">
        <div className="photo-review-head">
          <div><p className="eyebrow">LiveGallery</p><h2 id="motion-review-title">{messages.modals.motionTitle}</h2></div>
          <button type="button" autoFocus onClick={onClose} aria-label={messages.modals.closeMotionAria}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="photo-review-image"><img src={motionClip.gifUrl} alt={messages.modals.motionAlt} /></div>
        <div className="motion-review-actions">
          {motionClip.videoBlob && <button type="button" onClick={() => downloadMotionBlob(motionClip.videoBlob!, 'webm')}><Download size={16} aria-hidden="true" /> {messages.modals.downloadVideo}</button>}
          <button type="button" onClick={() => downloadMotionBlob(motionClip.gifBlob, 'gif')}><Download size={16} aria-hidden="true" /> {messages.modals.downloadGif}</button>
        </div>
      </div>
    </div>
  )
}

export function GalleryShareModal({
  galleryShare,
  onCopyCode,
  onClose,
}: {
  galleryShare: GalleryShare & { qrDataUrl: string }
  onCopyCode: () => void
  onClose: () => void
}) {
  const { messages } = useLocale()
  return (
    <div className="gallery-share-modal" role="dialog" aria-modal="true" aria-labelledby="gallery-share-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="gallery-share-card">
        <button type="button" className="gallery-share-close" autoFocus onClick={onClose} aria-label={messages.modals.closeQrAria}><X size={18} aria-hidden="true" /></button>
        <p className="eyebrow">{messages.modals.galleryReadyEyebrow}</p>
        <h2 id="gallery-share-title">{messages.modals.galleryReadyTitle}</h2>
        <img className="gallery-qr" src={galleryShare.qrDataUrl} alt={messages.modals.qrAlt(galleryShare.shareCode)} />
        <span className="gallery-code-label">{messages.modals.albumCodeLabel}</span>
        <button type="button" className="gallery-code" onClick={onCopyCode} title={messages.modals.copyCodeTitle}>
          <span>{galleryShare.shareCode.toUpperCase()}</span>
          <Copy size={16} aria-hidden="true" />
        </button>
        <p>
          {messages.modals.shareInstructionsBeforeHost} <strong>{formatShareHost(galleryShare.url)}</strong>{' '}
          {messages.modals.shareInstructionsAfterHost}
        </p>
        <a className="primary-button gallery-open-link" href={galleryShare.url} target="_blank" rel="noreferrer">
          <Eye size={17} aria-hidden="true" /> {messages.modals.openLiveGallery}
        </a>
      </div>
    </div>
  )
}
