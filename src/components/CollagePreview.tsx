import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getCollageSize, type CollageSettings } from '../collage'
import { composeCollage } from '../rendering'
import type { BoothSession } from '../types'

interface Props {
  session: BoothSession
  settings: CollageSettings
}

export function CollagePreview({ session, settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null)
  const [renderSize, setRenderSize] = useState<{ width: number; height: number } | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState(false)
  const output = getCollageSize(settings.format)

  useEffect(() => {
    let cancelled = false
    setRendering(true)
    setRenderError(false)
    composeCollage(session, settings, 0.5)
      .then((rendered) => {
        if (cancelled || !canvasRef.current) return
        canvasRef.current.width = rendered.width
        canvasRef.current.height = rendered.height
        setRenderSize({ width: rendered.width, height: rendered.height })
        canvasRef.current.getContext('2d')?.drawImage(rendered, 0, 0)
      })
      .catch(() => { if (!cancelled) setRenderError(true) })
      .finally(() => { if (!cancelled) setRendering(false) })
    return () => { cancelled = true }
  }, [session, settings])

  useLayoutEffect(() => {
    const parent = wrapRef.current?.parentElement
    if (!parent) return
    const fit = () => {
      const width = Math.max(1, parent.clientWidth - 24)
      const height = Math.max(1, parent.clientHeight - 24)
      const source = renderSize ?? { width: Math.round(output.width * 0.5), height: Math.round(output.height * 0.5) }
      const scale = Math.min(1, width / source.width, height / source.height)
      setFitSize({ width: source.width * scale, height: source.height * scale })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [output.height, output.width, renderSize])

  return (
    <div ref={wrapRef} className="collage-final-preview">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Bản xem trước nền ghép hoàn chỉnh"
        style={{ width: fitSize?.width, height: fitSize?.height, aspectRatio: `${renderSize?.width ?? output.width}/${renderSize?.height ?? output.height}` }}
      />
      {rendering && <span className="render-badge">Đang tạo bản xem trước…</span>}
      {renderError && <span className="render-badge">Không thể hiển thị nền ghép.</span>}
    </div>
  )
}
