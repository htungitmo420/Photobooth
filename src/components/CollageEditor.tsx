import { Maximize2, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getCollageSize, type CollageItem, type CollageSettings } from '../collage'
import { getFrameSize } from '../frameSize'
import { composeStrip } from '../rendering'
import type { BoothSession } from '../types'

interface Props {
  session: BoothSession
  settings: CollageSettings
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onUpdate: (id: string, changes: Partial<CollageItem>) => void
  onRemove: (id: string) => void
}

export function CollageEditor({ session, settings, selectedId, onSelect, onMove, onUpdate, onRemove }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [stripUrl, setStripUrl] = useState<string | null>(null)
  const fallbackSize = getFrameSize(session.layout, session.frame)
  const [stripSize, setStripSize] = useState(fallbackSize)
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null)
  const output = getCollageSize(settings.format)

  useEffect(() => {
    let cancelled = false
    composeStrip(session, 0.45).then((canvas) => {
      if (cancelled) return
      setStripSize({ width: canvas.width, height: canvas.height })
      setStripUrl(canvas.toDataURL('image/png'))
    }).catch(() => {
      if (!cancelled) setStripUrl(null)
    })
    return () => { cancelled = true }
  }, [session])

  useLayoutEffect(() => {
    const parent = stageRef.current?.parentElement
    if (!parent) return
    const fit = () => {
      const availableWidth = Math.max(1, parent.clientWidth - 18)
      const availableHeight = Math.max(1, parent.clientHeight - 18)
      const scale = Math.min(availableWidth / output.width, availableHeight / output.height)
      setFitSize({ width: output.width * scale, height: output.height * scale })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [output.height, output.width])

  const startMove = (event: React.PointerEvent<HTMLButtonElement>, item: CollageItem) => {
    if (!stageRef.current) return
    event.preventDefault()
    event.stopPropagation()
    onSelect(item.id)
    const pointerId = event.pointerId
    const rect = stageRef.current.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      onMove(
        item.id,
        Math.min(1.12, Math.max(-0.12, item.x + (moveEvent.clientX - startX) / rect.width)),
        Math.min(1.12, Math.max(-0.12, item.y + (moveEvent.clientY - startY) / rect.height)),
      )
    }
    const stop = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  const startResize = (event: React.PointerEvent<HTMLButtonElement>, item: CollageItem) => {
    if (!stageRef.current) return
    event.preventDefault()
    event.stopPropagation()
    const pointerId = event.pointerId
    const rect = stageRef.current.getBoundingClientRect()
    const centerX = rect.left + item.x * rect.width
    const centerY = rect.top + item.y * rect.height
    const initialDistance = Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY))
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const distance = Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY)
      onUpdate(item.id, { width: Math.min(0.95, Math.max(0.12, item.width * distance / initialDistance)) })
    }
    const stop = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  const startRotate = (event: React.PointerEvent<HTMLButtonElement>, item: CollageItem) => {
    if (!stageRef.current) return
    event.preventDefault()
    event.stopPropagation()
    const pointerId = event.pointerId
    const rect = stageRef.current.getBoundingClientRect()
    const centerX = rect.left + item.x * rect.width
    const centerY = rect.top + item.y * rect.height
    const initialAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX)
      onUpdate(item.id, { rotation: Math.round(item.rotation + (angle - initialAngle) * 180 / Math.PI) })
    }
    const stop = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  const patternLayers = settings.pattern === 'dots'
    ? ['radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px)']
    : settings.pattern === 'grid'
      ? ['linear-gradient(rgba(255,255,255,.11) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(255,255,255,.11) 1px, transparent 1px)']
      : []
  const imageLayer = settings.backgroundImageUrl ? `url(${JSON.stringify(settings.backgroundImageUrl)})` : null
  const backgroundLayers = [...patternLayers, ...(imageLayer ? [imageLayer] : [])]
  const patternSize = settings.pattern === 'dots' ? '18px 18px' : '28px 28px'
  const backgroundSizes = [...patternLayers.map(() => patternSize), ...(imageLayer ? ['cover'] : [])]
  const backgroundPositions = [...patternLayers.map(() => '0 0'), ...(imageLayer ? ['center'] : [])]
  const backgroundRepeats = [...patternLayers.map(() => 'repeat'), ...(imageLayer ? ['no-repeat'] : [])]
  const editorTopZIndex = Math.max(1000, ...settings.items.map((item) => item.zIndex)) + 1

  return (
    <div className="collage-preview-shell">
      <div
        ref={stageRef}
        className="collage-stage"
        aria-label="Nền ghép photobooth"
        style={{
          width: fitSize?.width,
          height: fitSize?.height,
          aspectRatio: `${output.width}/${output.height}`,
          backgroundColor: settings.background,
          backgroundImage: backgroundLayers.length > 0 ? backgroundLayers.join(', ') : undefined,
          backgroundSize: backgroundSizes.length > 0 ? backgroundSizes.join(', ') : undefined,
          backgroundPosition: backgroundPositions.length > 0 ? backgroundPositions.join(', ') : undefined,
          backgroundRepeat: backgroundRepeats.length > 0 ? backgroundRepeats.join(', ') : undefined,
        }}
        onPointerDown={(event) => { if (event.target === event.currentTarget) onSelect(null) }}
      >
        {settings.items.slice().sort((a, b) => a.zIndex - b.zIndex).map((item) => (
          <div
            className={`collage-item ${selectedId === item.id ? 'selected' : ''}`}
            key={item.id}
            style={{
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              width: `${item.width * 100}%`,
              aspectRatio: `${stripSize.width}/${stripSize.height}`,
              transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
              zIndex: selectedId === item.id ? editorTopZIndex : item.zIndex,
            }}
          >
            <button
              className="collage-item-body"
              aria-label="Di chuyển bản photobooth"
              onPointerDown={(event) => startMove(event, item)}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 0.025 : 0.008
                const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
                if (!delta) return
                event.preventDefault()
                onMove(item.id, item.x + delta[0], item.y + delta[1])
              }}
            >
              {stripUrl ? <img src={stripUrl} alt="" draggable={false} /> : <span>Đang tạo ảnh…</span>}
            </button>
            {selectedId === item.id && <>
              <button className="collage-direct-control rotate" onPointerDown={(event) => startRotate(event, item)} aria-label="Giữ và kéo để xoay"><RotateCw /></button>
              <button className="collage-direct-control remove" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onRemove(item.id) }} aria-label="Xóa bản photobooth"><Trash2 /></button>
              <button className="collage-direct-control resize" onPointerDown={(event) => startResize(event, item)} aria-label="Giữ và kéo để đổi kích thước"><Maximize2 /></button>
            </>}
          </div>
        ))}
        {settings.message.trim() && (
          <p
            className={`collage-message ${settings.messagePosition}`}
            style={{ color: settings.messageColor }}
          >
            {settings.message.trim()}
          </p>
        )}
      </div>
    </div>
  )
}
