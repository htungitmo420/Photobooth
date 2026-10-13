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
]

export const FALLBACK_FRAMES: BoothFrame[] = [
  { id: 'paper', name: 'Giấy trắng', description: 'Sạch và tối giản', config: { background: '#fffdf8', accent: '#e85d44', textColor: '#25221f', radius: 24 }, source: 'fallback' },
  { id: 'midnight', name: 'Đêm đen', description: 'Tương phản và điện ảnh', config: { background: '#171717', accent: '#f4c95d', textColor: '#fff8ef', radius: 20 }, source: 'fallback' },
  { id: 'cream', name: 'Kem bơ', description: 'Ấm áp và hoài cổ', config: { background: '#f6e7c9', accent: '#a65a3a', textColor: '#4b382a', radius: 18 }, source: 'fallback' },
  { id: 'blush', name: 'Hồng phấn', description: 'Dịu dàng và vui tươi', config: { background: '#f9dbe4', accent: '#d44872', textColor: '#61283a', radius: 28 }, source: 'fallback' },
  { id: 'lavender', name: 'Oải hương', description: 'Mơ màng, nhẹ nhàng', config: { background: '#e8e0f6', accent: '#7654a8', textColor: '#382653', radius: 28 }, source: 'fallback' },
  { id: 'film', name: 'Cuộn phim', description: 'Viền phim cổ điển', config: { background: '#1f1b18', accent: '#f0a34a', textColor: '#f8ead7', radius: 8 }, source: 'fallback' },
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
  text: [['love', 'LOVE'], ['wow', 'WOW!'], ['xoxo', 'XOXO'], ['besties', 'BFF'], ['yes', 'YES!'], ['smile', 'SMILE']],
  nature: [['clover', '🍀'], ['flower', '🌼'], ['cherry', '🍒'], ['leaf', '🌿'], ['sun', '☀️'], ['rainbow', '🌈'], ['cloud', '☁️'], ['butterfly', '🦋']],
  shapes: [['sparkle', '✦'], ['heart-outline', '♡'], ['star', '★'], ['circle', '●'], ['diamond', '◆'], ['burst', '✺'], ['moon', '☾'], ['flower-shape', '✿']],
  lucky: [['mushroom', '🍄'], ['dice', '🎲'], ['horseshoe', '🧲'], ['crystal', '💎'], ['key', '🗝️'], ['eight-ball', '🎱'], ['red-envelope', '🧧'], ['fortune', '🥠']],
  retro: [['camera', '📷'], ['cassette', '📼'], ['disc', '💿'], ['game', '🎮'], ['phone', '☎️'], ['glasses', '🕶️'], ['roller', '🛼'], ['lightning', '⚡']],
}

export const STICKER_CATEGORIES: Array<{ id: 'all' | StickerCategory; name: string }> = [
  { id: 'all', name: 'Tất cả' },
  { id: 'cute', name: 'Dễ thương' },
  { id: 'text', name: 'Chữ' },
  { id: 'nature', name: 'Thiên nhiên' },
  { id: 'shapes', name: 'Hình khối' },
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
