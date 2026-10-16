export type AppStep = 'setup' | 'capture' | 'edit'
export type LayoutId = 'strip3' | 'strip4' | 'grid4' | 'polaroid'
export type FilterId = 'original' | 'mono' | 'warm' | 'cool' | 'vintage' | 'soft'
export type FlashMode = 'off' | 'auto' | 'on'
export type StickerCategory = 'cute' | 'text' | 'nature' | 'shapes' | 'lucky' | 'retro'

export interface BoothLayout {
  id: LayoutId
  name: string
  description: string
  slots: number
  width: number
  height: number
  kind: 'strip' | 'grid' | 'polaroid'
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
  source: 'supabase' | 'fallback' | 'local'
  layoutId?: LayoutId
  assetWidth?: number
  assetHeight?: number
}

export interface CapturedPhoto {
  id: string
  dataUrl: string
}

export interface StickerAsset {
  id: string
  name: string
  category: StickerCategory
  kind: 'emoji' | 'image'
  content: string
}

export interface BoothSticker {
  id: string
  assetId: string
  name: string
  kind: 'emoji' | 'image'
  content: string
  x: number
  y: number
  size: number
  rotation: number
  flipX: boolean
  zIndex: number
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
