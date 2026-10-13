import { useCallback, useEffect, useRef, useState } from 'react'
import { getSourceCrop, type CameraTransform } from '../cameraGeometry'

export type CameraFacing = 'user' | 'environment'

interface ExtendedCapabilities extends MediaTrackCapabilities {
  zoom?: { min: number; max: number; step?: number }
  torch?: boolean
}

interface ExtendedConstraintSet extends MediaTrackConstraintSet {
  zoom?: number
  torch?: boolean
}

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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)

  const getTrack = useCallback(() => streamRef.current?.getVideoTracks()[0] ?? null, [])

  const stop = useCallback(() => {
    requestRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
    setLoading(false)
    setZoomRange(null)
    setTorchSupported(false)
  }, [])

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const available = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput')
      setDevices(available)
    } catch {
      setDevices([])
    }
  }, [])

  const start = useCallback(async (nextFacing: CameraFacing = facing, deviceId?: string) => {
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
      const video: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
      } catch (initialError) {
        if (initialError instanceof DOMException && initialError.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } else throw initialError
      }

      if (requestId !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() as ExtendedCapabilities : {}
      const zoom = capabilities.zoom
      setZoomRange(zoom ? { min: zoom.min, max: zoom.max, step: zoom.step || 0.1 } : null)
      setTorchSupported(capabilities.torch === true)
      setSelectedDeviceId(settings.deviceId ?? deviceId ?? null)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setFacing(nextFacing)
      setActive(true)
      await refreshDevices()
      return true
    } catch (caught) {
      setError(describeCameraError(caught))
      setActive(false)
      return false
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [facing, refreshDevices])

  const selectDevice = useCallback(async (deviceId: string) => start(facing, deviceId), [facing, start])

  const switchFacing = useCallback(async () => start(facing === 'user' ? 'environment' : 'user'), [facing, start])

  const applyHardwareZoom = useCallback(async (value: number) => {
    const track = getTrack()
    if (!track || !zoomRange) return false
    try {
      const normalized = Math.min(zoomRange.max, Math.max(zoomRange.min, value))
      await track.applyConstraints({ advanced: [{ zoom: normalized } as ExtendedConstraintSet] })
      return true
    } catch {
      return false
    }
  }, [getTrack, zoomRange])

  const setTorch = useCallback(async (enabled: boolean) => {
    const track = getTrack()
    if (!track || !torchSupported) return false
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled } as ExtendedConstraintSet] })
      return true
    } catch {
      return false
    }
  }, [getTrack, torchSupported])

  const measureBrightness = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null
    const canvas = document.createElement('canvas')
    canvas.width = 48
    canvas.height = 36
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let sum = 0
    for (let index = 0; index < pixels.length; index += 16) {
      sum += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722
    }
    return sum / (pixels.length / 16) / 255
  }, [])

  const capture = useCallback((mirror: boolean, transform: CameraTransform, targetAspect = 4 / 3) => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return null
    const crop = getSourceCrop(video.videoWidth, video.videoHeight, targetAspect, transform)
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(1920, Math.round(crop.width))
    canvas.height = Math.round(canvas.width / targetAspect)
    const context = canvas.getContext('2d')
    if (!context) return null
    if (mirror) {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.94)
  }, [])

  useEffect(() => stop, [stop])

  return {
    videoRef, active, loading, error, facing, devices, selectedDeviceId, zoomRange, torchSupported,
    start, stop, switchFacing, selectDevice, applyHardwareZoom, setTorch, measureBrightness, capture,
  }
}
