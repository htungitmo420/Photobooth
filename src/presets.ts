import type { BoothFrame, BoothLayout, FilterId, StickerAsset, StickerCategory } from './types'

export const LAYOUTS: BoothLayout[] = [
  {
    id: 'strip3',
    name: 'Dải 3 ảnh',
    description: 'Gọn gàng, hợp chụp một mình',
    slots: 3,
    width: 900,
    height: 2100,
    kind: 'strip',
  },
  {
    id: 'strip4',
    name: 'Dải 4 ảnh',
    description: 'Kiểu photobooth kinh điển',
    slots: 4,
    width: 900,
    height: 2400,
    kind: 'strip',
  },
  {
    id: 'grid4',
    name: 'Lưới 2 × 2',
    description: 'Vuông vắn, dễ đăng mạng xã hội',
    slots: 4,
    width: 1500,
    height: 1500,
    kind: 'grid',
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    description: 'Một ảnh lớn, chân ảnh rộng',
    slots: 1,
    width: 1200,
    height: 1500,
    kind: 'polaroid',
  },
]

export const FALLBACK_FRAMES: BoothFrame[] = [
  {
    id: 'paper',
    name: 'Trắng viền đen',
    description: 'Nền trắng, viền ảnh đen bo tròn',
    config: { background: '#ffffff', accent: '#111111', textColor: '#111111', radius: 26 },
    source: 'fallback',
  },
]

export const FILTERS: Array<{ id: FilterId; name: string; css: string }> = [
  { id: 'original', name: 'Gốc', css: 'none' },
  { id: 'mono', name: 'Đen trắng', css: 'grayscale(1) contrast(1.06)' },
  { id: 'warm', name: 'Ấm', css: 'sepia(.18) saturate(1.12) brightness(1.03)' },
  { id: 'cool', name: 'Lạnh', css: 'saturate(.92) hue-rotate(12deg) brightness(1.02)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(.32) saturate(.8) contrast(.94)' },
  { id: 'soft', name: 'Nhẹ', css: 'brightness(1.08) contrast(.88) saturate(.92)' },
]

const STICKER_GROUPS: Record<StickerCategory, Array<[string, string]>> = {
  cute: [['rabbit', '🐰'], ['bear', '🧸'], ['bow', '🎀'], ['heart', '💗'], ['chick', '🐥'], ['cat', '🐱'], ['flower-face', '🌸'], ['sparkle-heart', '💖']],
  text: [],
  nature: [['clover', '🍀'], ['flower', '🌼'], ['cherry', '🍒'], ['leaf', '🌿'], ['sun', '☀️'], ['rainbow', '🌈'], ['cloud', '☁️'], ['butterfly', '🦋']],
  shapes: [],
  lucky: [['mushroom', '🍄'], ['dice', '🎲'], ['horseshoe', '🧲'], ['crystal', '💎'], ['key', '🗝️'], ['eight-ball', '🎱'], ['red-envelope', '🧧'], ['fortune', '🥠']],
  retro: [['camera', '📷'], ['cassette', '📼'], ['disc', '💿'], ['game', '🎮'], ['phone', '☎️'], ['glasses', '🕶️'], ['roller', '🛼'], ['lightning', '⚡']],
}

export const STICKER_CATEGORIES: Array<{ id: 'all' | StickerCategory; name: string }> = [
  { id: 'all', name: 'Tất cả' },
  { id: 'cute', name: 'Dễ thương' },
  { id: 'nature', name: 'Thiên nhiên' },
  { id: 'lucky', name: 'May mắn' },
  { id: 'retro', name: 'Retro' },
]

export const FALLBACK_STICKERS: StickerAsset[] = Object.entries(STICKER_GROUPS).flatMap(([category, items]) =>
  items.map(([id, content]) => ({
    id: `${category}-${id}`,
    name: id.replaceAll('-', ' '),
    category: category as StickerCategory,
    kind: 'emoji' as const,
    content,
  })),
)
