import { useEffect, useState } from 'react'
import { loadRemoteBackgrounds, type RemoteBackground } from '../lib/backgrounds'
import { loadFrames } from '../lib/frames'
import {
  deleteLocalBackground,
  loadLocalBackgrounds,
  revokeBackgroundUrls,
  saveLocalBackground,
  type LocalBackground,
} from '../lib/localBackgrounds'
import {
  deleteLocalFrame,
  loadLocalFrames,
  revokeFrameUrls,
  saveLocalFrame,
} from '../lib/localFrames'
import { loadStickers } from '../lib/stickers'
import { FALLBACK_FRAMES, FALLBACK_STICKERS } from '../presets'
import type { BoothFrame, BoothLayout, StickerAsset } from '../types'

interface UseBoothCatalogOptions {
  onInitialFramesLoaded: (loaded: BoothFrame[]) => void
  onNotice: (message: string | null) => void
}

export function useBoothCatalog({ onInitialFramesLoaded, onNotice }: UseBoothCatalogOptions) {
  const [frames, setFrames] = useState<BoothFrame[]>(FALLBACK_FRAMES)
  const [remoteFrames, setRemoteFrames] = useState(false)
  const [stickerAssets, setStickerAssets] = useState<StickerAsset[]>(FALLBACK_STICKERS)
  const [remoteStickers, setRemoteStickers] = useState(false)
  const [localBackgrounds, setLocalBackgrounds] = useState<LocalBackground[]>([])
  const [remoteBackgrounds, setRemoteBackgrounds] = useState<RemoteBackground[]>([])
  const [remoteBackgroundSource, setRemoteBackgroundSource] = useState(false)

  useEffect(() => {
    let disposed = false
    let localFrameUrls: BoothFrame[] = []
    Promise.all([loadFrames(), loadLocalFrames().catch(() => [])]).then(([catalog, local]) => {
      localFrameUrls = local
      if (disposed) return revokeFrameUrls(local)
      const loaded = [...local, ...catalog.frames]
      setFrames(loaded)
      onInitialFramesLoaded(loaded)
      setRemoteFrames(catalog.remote)
    })
    loadStickers().then((catalog) => {
      if (!disposed) {
        setStickerAssets(catalog.stickers)
        setRemoteStickers(catalog.remote)
      }
    })
    return () => {
      disposed = true
      revokeFrameUrls(localFrameUrls)
    }
    // Initial catalog load should run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadRemoteBackgrounds().then((catalog) => {
      setRemoteBackgrounds(catalog.backgrounds)
      setRemoteBackgroundSource(catalog.remote)
    })
  }, [])

  useEffect(() => {
    let disposed = false
    let loadedBackgrounds: LocalBackground[] = []
    loadLocalBackgrounds()
      .then((backgrounds) => {
        loadedBackgrounds = backgrounds
        if (disposed) revokeBackgroundUrls(backgrounds)
        else setLocalBackgrounds(backgrounds)
      })
      .catch(() => { /* Local backgrounds are optional. */ })
    return () => {
      disposed = true
      revokeBackgroundUrls(loadedBackgrounds)
    }
  }, [])

  const addLocalFrame = async (file: File, layout: BoothLayout): Promise<BoothFrame | null> => {
    try {
      const added = await saveLocalFrame(file, file.name.replace(/\.[^.]+$/, ''), layout)
      setFrames((current) => [added, ...current])
      onNotice('Đã lưu frame vào trình duyệt này.')
      return added
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Không thể lưu frame.')
      return null
    }
  }

  const removeLocalFrame = async (item: BoothFrame): Promise<void> => {
    await deleteLocalFrame(item.id)
    if (item.assetUrl) URL.revokeObjectURL(item.assetUrl)
    setFrames((current) => current.filter((candidate) => candidate.id !== item.id))
    onNotice('Đã xóa frame khỏi trình duyệt.')
  }

  const addLocalBackground = async (file: File): Promise<LocalBackground | null> => {
    try {
      const added = await saveLocalBackground(file)
      setLocalBackgrounds((current) => [added, ...current])
      onNotice('Đã lưu nền ghép vào trình duyệt này.')
      return added
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Không thể lưu nền ghép.')
      return null
    }
  }

  const removeLocalBackground = async (item: LocalBackground): Promise<void> => {
    await deleteLocalBackground(item.id)
    setLocalBackgrounds((current) => current.filter((candidate) => candidate.id !== item.id))
    URL.revokeObjectURL(item.url)
    onNotice('Đã xóa nền ghép khỏi trình duyệt.')
  }

  return {
    frames,
    remoteFrames,
    stickerAssets,
    remoteStickers,
    localBackgrounds,
    remoteBackgrounds,
    remoteBackgroundSource,
    addLocalFrame,
    removeLocalFrame,
    addLocalBackground,
    removeLocalBackground,
  }
}
