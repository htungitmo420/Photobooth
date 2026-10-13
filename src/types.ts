export type AppStep = 'setup' | 'capture' | 'edit'
export type LayoutId = 'strip3' | 'strip4' | 'grid4'
export type FilterId = 'original' | 'mono' | 'warm' | 'cool' | 'vintage' | 'soft'

export interface BoothLayout {
  id: LayoutId
  name: string
  description: string
  slots: number
  width: number
  height: number
  kind: 'strip' | 'grid'
}

export interface FrameConfig {
  background: string
  accent: string
  textColor: string
  radius: number
}

export interface BoothFrame {
  id: string
  name: string
  description: string
  config: FrameConfig
  assetUrl?: string
  source: 'supabase' | 'fallback'
}

export interface CapturedPhoto {
  id: string
  dataUrl: string
}

export interface BoothSticker {
  id: string
  emoji: string
  x: number
  y: number
  size: number
}

export interface BoothSession {
  layout: BoothLayout
  frame: BoothFrame
  filter: FilterId
  photos: CapturedPhoto[]
  caption: string
  showDate: boolean
  date: Date
  stickers: BoothSticker[]
}
