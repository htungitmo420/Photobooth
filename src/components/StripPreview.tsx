import { Maximize2, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { composeStrip } from '../rendering'
import type { BoothSession } from '../types'

interface Props {
  session: BoothSession
  interactive?: boolean
  onMoveSticker?: (id: string, x: number, y: number) => void
  onUpdateSticker?: (id: string, changes: Partial<BoothSession['stickers'][number]>) => void
  onRemoveSticker?: (id: string) => void
  selectedStickerId?: string | null
  onSelectSticker?: (id: string) => void
  onPreview?: () => void
}

export function StripPreview({ session, interactive = false, onMoveSticker, onUpdateSticker, onRemoveSticker, selectedStickerId, onSelectSticker, onPreview }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(false)

  useEffect(() => {
    let cancelled = false
    setRendering(true)
    composeStrip(interactive ? { ...session, stickers: [] } : session, 0.5)
      .then((canvas) => {
        if (cancelled || !canvasRef.current) return
        canvasRef.current.width = canvas.width
        canvasRef.current.height = canvas.height
        canvasRef.current.getContext('2d')?.drawImage(canvas, 0, 0)
      })
      .finally(() => !cancelled && setRendering(false))
    return () => { cancelled = true }
  }, [interactive, session])

  const moveSticker = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (!interactive || !onMoveSticker || !wrapRef.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const handleMove = (moveEvent: PointerEvent) => {
      const rect = wrapRef.current!.getBoundingClientRect()
      const x = Math.min(0.96, Math.max(0.04, (moveEvent.clientX - rect.left) / rect.width))
      const y = Math.min(0.96, Math.max(0.04, (moveEvent.clientY - rect.top) / rect.height))
      onMoveSticker(id, x, y)
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
  }

  const resizeSticker = (event: React.PointerEvent<HTMLButtonElement>, id: string, initialSize: number) => {
    if (!interactive || !onUpdateSticker || !wrapRef.current) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = wrapRef.current.getBoundingClientRect()
    const sticker = session.stickers.find((item) => item.id === id)
    if (!sticker) return
    const centerX = rect.left + sticker.x * rect.width
    const centerY = rect.top + sticker.y * rect.height
    const initialDistance = Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY))
    const handleMove = (moveEvent: PointerEvent) => {
      const distance = Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY)
      onUpdateSticker(id, { size: Math.min(.36, Math.max(.06, initialSize * distance / initialDistance)) })
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
  }

  return (
    <div ref={wrapRef} className={`strip-preview ${session.frame.assetUrl ? 'asset-frame' : ''}`} style={{ aspectRatio: `${session.layout.width}/${session.layout.height}` }}>
      <canvas
        ref={canvasRef}
        aria-label={onPreview ? 'Mở bản xem trước dải ảnh' : 'Bản xem trước dải ảnh'}
        role={onPreview ? 'button' : 'img'}
        tabIndex={onPreview ? 0 : undefined}
        onClick={onPreview}
        onKeyDown={(event) => {
          if (onPreview && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            onPreview()
          }
        }}
      />
      {rendering && <span className="render-badge">Đang cập nhật…</span>}
      {interactive && session.stickers.map((sticker) => (
        <div
          className={`sticker-node ${selectedStickerId === sticker.id ? 'selected' : ''}`}
          key={sticker.id}
          style={{
            left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`,
            width: `${sticker.size * 100}%`, aspectRatio: '1',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <button
            className="sticker-handle"
            aria-label={`Di chuyển sticker ${sticker.name}`}
            onClick={() => onSelectSticker?.(sticker.id)}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.025 : 0.008
              const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
              if (!delta || !onMoveSticker) return
              event.preventDefault()
              onMoveSticker(sticker.id, Math.min(.96, Math.max(.04, sticker.x + delta[0])), Math.min(.96, Math.max(.04, sticker.y + delta[1])))
            }}
            onPointerDown={(event) => moveSticker(event, sticker.id)}
            style={{ transform: `rotate(${sticker.rotation}deg) scaleX(${sticker.flipX ? -1 : 1})` }}
          >
            {sticker.kind === 'image'
              ? <img src={sticker.content} alt="" draggable={false} />
              : <span aria-hidden="true">{sticker.content}</span>}
          </button>
          {selectedStickerId === sticker.id && <>
            <button className="sticker-direct-control rotate" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onUpdateSticker?.(sticker.id, { rotation: sticker.rotation + 15 }) }} aria-label={`Xoay sticker ${sticker.name}`}><RotateCw /></button>
            <button className="sticker-direct-control remove" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onRemoveSticker?.(sticker.id) }} aria-label={`Xóa sticker ${sticker.name}`}><Trash2 /></button>
            <button className="sticker-direct-control resize" onPointerDown={(event) => resizeSticker(event, sticker.id, sticker.size)} aria-label={`Đổi kích thước sticker ${sticker.name}`}><Maximize2 /></button>
          </>}
        </div>
      ))}
    </div>
  )
}
