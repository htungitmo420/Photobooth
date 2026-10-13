import { useEffect, useRef, useState } from 'react'
import { composeStrip } from '../rendering'
import type { BoothSession } from '../types'

interface Props {
  session: BoothSession
  interactive?: boolean
  onMoveSticker?: (id: string, x: number, y: number) => void
}

export function StripPreview({ session, interactive = false, onMoveSticker }: Props) {
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

  return (
    <div ref={wrapRef} className="strip-preview" style={{ aspectRatio: `${session.layout.width}/${session.layout.height}` }}>
      <canvas ref={canvasRef} aria-label="Bản xem trước dải ảnh" />
      {rendering && <span className="render-badge">Đang cập nhật…</span>}
      {interactive && session.stickers.map((sticker) => (
        <button
          className="sticker-handle"
          key={sticker.id}
          aria-label={`Di chuyển sticker ${sticker.emoji}`}
          onPointerDown={(event) => moveSticker(event, sticker.id)}
          style={{ left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, fontSize: `${sticker.size * 100}%` }}
        >
          <span aria-hidden="true">{sticker.emoji}</span>
        </button>
      ))}
    </div>
  )
}
