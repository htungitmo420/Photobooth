export type ZoomMode = 'web' | 'device'

export function suggestedZoomMode(label: string): ZoomMode {
  if (/integrated|built.?in|internal|facetime|front camera/i.test(label)) return 'web'
  if (/sony|canon|nikon|fujifilm|panasonic|lumix|gopro|obs|virtual|capture|hdmi|elgato|usb/i.test(label)) return 'device'
  return 'web'
}
