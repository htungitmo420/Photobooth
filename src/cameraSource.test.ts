import { describe, expect, it } from 'vitest'
import { suggestedZoomMode } from './cameraSource'

describe('camera zoom source', () => {
  it('uses web zoom for the built-in camera', () => {
    expect(suggestedZoomMode('Integrated Camera (30c9:0056)')).toBe('web')
  })

  it('leaves Sony and capture-card zoom on the external device', () => {
    expect(suggestedZoomMode('Sony Camera (Imaging Edge)')).toBe('device')
    expect(suggestedZoomMode('USB HDMI Capture')).toBe('device')
  })
})
