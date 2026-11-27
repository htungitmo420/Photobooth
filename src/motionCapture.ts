export const MOTION_BURST_DURATION_MS = 1600
export const MOTION_BURST_FPS = 15
export const MOTION_BURST_INTERVAL_MS = 66
export const MOTION_BURST_MAX_FRAMES = 24
export const MOTION_HOLD_FRAMES = 8

export interface MotionClip {
  videoBlob: Blob | null
  videoMimeType?: string
  videoUrl: string | null
  posterUrl: string
  durationMs: number
}

export function selectRecorderMimeType(isSupported: (mimeType: string) => boolean) {
  return [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find(isSupported) ?? ''
}

export function selectBestVideoMimeType(isSupported: (mimeType: string) => boolean) {
  return [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1.4D401E',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find(isSupported) ?? ''
}

export function extensionForVideoMime(mimeType: string | undefined | null): 'mp4' | 'webm' {
  return (mimeType ?? '').trim().toLowerCase().startsWith('video/mp4') ? 'mp4' : 'webm'
}

export function revokeMotionClip(clip: MotionClip | null) {
  if (!clip) return
  if (clip.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(clip.videoUrl)
  if (clip.posterUrl.startsWith('blob:')) URL.revokeObjectURL(clip.posterUrl)
}

export function downloadMotionBlob(blob: Blob, extension: 'mp4' | 'webm') {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `moving-strip-${Date.now()}.${extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
