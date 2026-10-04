import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/services/api'

export interface DataState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** Carga datos de la API con cancelación de respuestas obsoletas. */
export function useGet<T = any>(
  path: string | null,
  query?: Record<string, string | number | boolean | null | undefined>,
): DataState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!path)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const key = JSON.stringify(query ?? {})

  useEffect(() => {
    if (!path) { setLoading(false); return }
    const id = ++seq.current
    setLoading(true)
    setError(null)
    api.get<T>(path, query)
      .then((d) => { if (id === seq.current) setData(d) })
      .catch((e: Error) => { if (id === seq.current) setError(e.message) })
      .finally(() => { if (id === seq.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
