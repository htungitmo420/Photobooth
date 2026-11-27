import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'khoanhkhac-theme'

function getSavedTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function useTheme(): [ThemeMode, () => void] {
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f3efe6' : '#11100f')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* Theme storage is optional. */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return [theme, toggleTheme]
}
