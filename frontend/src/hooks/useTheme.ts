import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function initial(): Theme {
  try {
    const s = localStorage.getItem('aurora.theme')
    if (s === 'light' || s === 'dark') return s
  } catch { /* noop */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('aurora.theme', theme) } catch { /* noop */ }
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}
