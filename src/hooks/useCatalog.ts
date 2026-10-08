import { useCallback, useEffect, useState } from 'react'
import { PRODUCTS } from '@/data/products'
import type { Product } from '@/types'
import { fetchCatalog } from '@/services/productService'

let cache: Product[] | null = null
let inflight: Promise<Product[]> | null = null

export function invalidateCatalogCache() {
  cache = null
  inflight = null
}

export interface CatalogState {
  products: Product[]
  loading: boolean
  online: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useCatalog(): CatalogState {
  const [products, setProducts] = useState<Product[]>(cache ?? PRODUCTS)
  const [loading, setLoading] = useState<boolean>(!cache)
  const [online, setOnline] = useState<boolean>(!!cache)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    cache = null
    inflight = null
    setLoading(true)
    try {
      const list = await fetchCatalog()
      cache = list
      setProducts(list)
      setOnline(true)
      setError(null)
    } catch (err) {
      setProducts(PRODUCTS)
      setOnline(false)
      setError(err instanceof Error ? err.message : 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cache) {
      setProducts(cache)
      setOnline(true)
      setLoading(false)
      return
    }
    let dead = false
    setLoading(true)
    if (!inflight) inflight = fetchCatalog()
    inflight
      .then((list) => {
        if (dead) return
        cache = list
        setProducts(list)
        setOnline(true)
        setError(null)
      })
      .catch((err) => {
        if (dead) return
        setProducts(PRODUCTS)
        setOnline(false)
        setError(err instanceof Error ? err.message : 'error')
      })
      .finally(() => {
        if (!dead) setLoading(false)
      })
    return () => {
      dead = true
    }
  }, [])

  return { products, loading, online, error, reload }
}