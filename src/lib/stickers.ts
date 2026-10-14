import { FALLBACK_STICKERS } from '../presets'
import type { StickerAsset, StickerCategory } from '../types'
import { supabase } from './supabase'

interface StickerRow {
  id: string
  name: string
  category: StickerCategory
  asset_path: string
}

export async function loadStickers(): Promise<{ stickers: StickerAsset[]; remote: boolean }> {
  if (!supabase) return { stickers: FALLBACK_STICKERS, remote: false }
  const client = supabase
  const { data, error } = await client
    .from('photobooth_stickers')
    .select('id,name,category,asset_path')
    .eq('is_published', true)
    .order('sort_order')

  if (error || !data?.length) return { stickers: FALLBACK_STICKERS, remote: false }
  const remote = (data as StickerRow[]).filter((row) => row.category !== 'text').map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    kind: 'image' as const,
    content: client.storage.from('photobooth-stickers').getPublicUrl(row.asset_path).data.publicUrl,
  }))
  return { stickers: [...remote, ...FALLBACK_STICKERS], remote: true }
}
