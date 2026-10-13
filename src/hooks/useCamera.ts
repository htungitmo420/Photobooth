import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraFacing = 'user' | 'environment'

function describeCameraError(error: unknown): string {
  if (!(error instanceof DOMException)) return 'Không thể mở camera. Hãy thử lại.'
  if (error.name === 'NotAllowedError') return 'Bạn chưa cấp quyền camera. Hãy cho phép rồi thử lại.'
  if (error.name === 'NotFoundError') return 'Không tìm thấy camera trên thiết bị này.'
  if (error.name === 'NotReadableError') return 'Camera đang được ứng dụng khác sử dụng.'
  return 'Không thể mở camera. Hãy kiểm tra quyền trình duyệt.'
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const requestRef = useRef(0)
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facing, setFacing] = useState<CameraFacing>('user')

  const stop = useCallback(() => {
    requestRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
    setLoading(false)
  }, [])

  const start = useCallback(async (nextFacing: CameraFacing = facing) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Trình duyệt này không hỗ trợ truy cập camera.')
      return false
    }
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    streamRef.current?.getTracks().forEach((track) => track.stop())
    setLoading(true)
    setError(null)

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (initialError) {
        if (initialError instanceof DOMException && initialError.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } else {
          throw initialError
        }
      }

      if (requestId !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setFacing(nextFacing)
      setActive(true)
      return true
    } catch (caught) {
      setError(describeCameraError(caught))
      setActive(false)
      return false
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [facing])

  const switchFacing = useCallback(async () => {
    const nextFacing = facing === 'user' ? 'environment' : 'user'
    return start(nextFacing)
  }, [facing, start])

  const capture = useCallback((mirror: boolean) => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return null
    if (mirror) {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  }, [])

  useEffect(() => stop, [stop])

  return { videoRef, active, loading, error, facing, start, stop, switchFacing, capture }
}
