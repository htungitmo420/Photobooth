export type CollageFormatId = 'landscape' | 'square' | 'portrait' | 'story'
export type CollagePattern = 'solid' | 'dots' | 'grid'

export interface CollageItem {
  id: string
  x: number
  y: number
  width: number
  rotation: number
  zIndex: number
}

export interface CollageSettings {
  format: CollageFormatId
  background: string
  backgroundImageUrl?: string
  pattern: CollagePattern
  items: CollageItem[]
}

export const MAX_COLLAGE_ITEMS = 6
export const DEFAULT_COLLAGE_BACKGROUND = '#5a3822'

export const COLLAGE_FORMATS: Array<{ id: CollageFormatId; name: string; width: number; height: number }> = [
  { id: 'landscape', name: 'Ngang 16:9', width: 1920, height: 1080 },
  { id: 'square', name: 'Vuông 1:1', width: 1080, height: 1080 },
  { id: 'portrait', name: 'Dọc 4:5', width: 1080, height: 1350 },
  { id: 'story', name: 'Story 9:16', width: 1080, height: 1920 },
]

export function getCollageSize(format: CollageFormatId) {
  return COLLAGE_FORMATS.find((item) => item.id === format) ?? COLLAGE_FORMATS[3]
}

export function createSingleCollageItem(id: string): CollageItem {
  return { id, x: 0.5, y: 0.5, width: 0.42, rotation: 0, zIndex: 1 }
}

export function createTwoStripCollage(ids: [string, string]): CollageItem[] {
  return [
    { id: ids[0], x: 0.34, y: 0.55, width: 0.42, rotation: -8, zIndex: 1 },
    { id: ids[1], x: 0.68, y: 0.49, width: 0.42, rotation: 8, zIndex: 2 },
  ]
}

export function getCollageItemSize(item: CollageItem, canvasWidth: number, sourceWidth: number, sourceHeight: number) {
  const width = item.width * canvasWidth
  return { width, height: width * sourceHeight / sourceWidth }
}
