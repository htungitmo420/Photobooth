import { FALLBACK_FRAMES } from '../presets'
import type { BoothFrame, FrameConfig } from '../types'
import { supabase } from './supabase'

interface FrameRow {
  id: string
  name: string
  description: string | null
  config: FrameConfig
  asset_path: string | null
}

export async function loadFrames(): Promise<{ frames: BoothFrame[]; remote: boolean }> {
  if (!supabase) return { frames: FALLBACK_FRAMES, remote: false }
  const client = supabase

  const { data, error } = await client
    .from('photobooth_frames')
    .select('id,name,description,config,asset_path')
    .eq('is_published', true)
    .order('sort_order')

  if (error || !data?.length) {
    console.warn('Không tải được frame từ Supabase:', error?.message)
    return { frames: FALLBACK_FRAMES, remote: false }
  }

  const frames = (data as FrameRow[]).map((row) => {
    const assetUrl = row.asset_path
      ? client.storage.from('photobooth-frames').getPublicUrl(row.asset_path).data.publicUrl
      : undefined

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      config: row.config,
      assetUrl,
      source: 'supabase' as const,
    }
  })

  return { frames, remote: true }
}
