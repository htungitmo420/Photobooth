import { supabase } from './supabase'

export interface RemoteBackground {
  id: string
  name: string
  url: string
}

interface BackgroundRow {
  id: string
  name: string
  asset_path: string
}

export async function loadRemoteBackgrounds(): Promise<{ backgrounds: RemoteBackground[]; remote: boolean }> {
  if (!supabase) return { backgrounds: [], remote: false }
  const client = supabase
  const { data, error } = await client
    .from('photobooth_backgrounds')
    .select('id,name,asset_path')
    .eq('is_published', true)
    .order('sort_order')
    .order('name')

  if (error) {
    console.warn('Không tải được nền từ Supabase:', error.message)
    return { backgrounds: [], remote: false }
  }

  const backgrounds = (data as BackgroundRow[] | null ?? []).map((item) => ({
    id: `supabase-${item.id}`,
    name: item.name,
    url: client.storage.from('photobooth-background').getPublicUrl(item.asset_path).data.publicUrl,
  }))

  return { backgrounds, remote: true }
}
