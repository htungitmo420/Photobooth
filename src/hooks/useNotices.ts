import { useCallback, useState } from 'react'
import { makeId } from '../lib/boothUtils'

export interface NoticeItem {
  id: string
  message: string
}

export function useNotices() {
  const [notices, setNotices] = useState<NoticeItem[]>([])

  const setNotice = useCallback((message: string | null) => {
    if (message === null) {
      setNotices([])
      return
    }
    const id = makeId('notice')
    setNotices((current) => [{ id, message }, ...current].slice(0, 4))
    window.setTimeout(() => {
      setNotices((current) => current.filter((item) => item.id !== id))
    }, 5500)
  }, [])

  const dismissNotice = useCallback((id: string) => {
    setNotices((current) => current.filter((item) => item.id !== id))
  }, [])

  return { notices, setNotice, dismissNotice }
}
