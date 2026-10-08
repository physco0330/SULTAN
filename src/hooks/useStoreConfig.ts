import { useEffect, useState } from 'react'
import { fetchConfig, FALLBACK_CONFIG } from '@/services/productService'
import type { StoreConfig } from '@/services/productService'

let cache: StoreConfig | null = null

export function invalidateConfigCache() {
  cache = null
}

export function useStoreConfig(): StoreConfig {
  const [config, setConfig] = useState<StoreConfig>(cache ?? FALLBACK_CONFIG)
  useEffect(() => {
    if (cache) {
      setConfig(cache)
      return
    }
    let dead = false
    fetchConfig()
      .then((c) => {
        if (dead) return
        cache = c
        setConfig(c)
      })
      .catch(() => {
        /* keep fallback */
      })
    return () => {
      dead = true
    }
  }, [])
  return config
}