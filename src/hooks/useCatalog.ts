import { useCallback, useEffect, useState } from 'react'
import { PRODUCTS } from '@/data/products'
import type { Product } from '@/types'
import { fetchCatalog } from '@/services/productService'
import { subscribeDataVersion } from '@/utils/liveSync'
import { isFeatureEnabled } from '@/config/features'
import { useWishlist } from '@/store/wishlist'

let cache: Product[] | null = null
let inflight: Promise<Product[]> | null = null

/** Quita de favoritos los productos que ya no existen en el catálogo. */
function syncWishlist(list: Product[]) {
  if (list.length) useWishlist.getState().prune(list.map((p) => p.id))
}

/** Filtra módulos desactivados (p. ej. Mujer) de cualquier lista de productos. */
function applyFeatureVisibility(list: Product[]): Product[] {
  return isFeatureEnabled('women') ? list : list.filter((p) => p.gender !== 'women')
}

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
  const [products, setProducts] = useState<Product[]>(() => applyFeatureVisibility(cache ?? PRODUCTS))
  const [loading, setLoading] = useState<boolean>(!cache)
  const [online, setOnline] = useState<boolean>(!!cache)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    cache = null
    inflight = null
    setLoading(true)
    try {
      const raw = await fetchCatalog()
      const list = applyFeatureVisibility(raw)
      cache = list
      setProducts(list)
      setOnline(true)
      setError(null)
      syncWishlist(raw)
    } catch (err) {
      setProducts(applyFeatureVisibility(PRODUCTS))
      setOnline(false)
      setError(err instanceof Error ? err.message : 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cache) {
      setProducts(applyFeatureVisibility(cache))
      setOnline(true)
      setLoading(false)
      syncWishlist(cache)
      return
    }
    let dead = false
    setLoading(true)
    if (!inflight) inflight = fetchCatalog()
    inflight
      .then((list) => {
        if (dead) return
        cache = list
        setProducts(applyFeatureVisibility(list))
        setOnline(true)
        setError(null)
        syncWishlist(list)
      })
      .catch((err) => {
        if (dead) return
        setProducts(applyFeatureVisibility(PRODUCTS))
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

  /* Live sync: when the admin (or another tab) changes data, refresh the
   * list silently in place — no loading spinner, no page reload. */
  useEffect(
    () =>
      subscribeDataVersion(() => {
        cache = null
        inflight = null
        fetchCatalog().then((list) => {
          cache = list
          setProducts(applyFeatureVisibility(list))
          setOnline(true)
          setError(null)
          syncWishlist(list)
        }).catch(() => {
          /* keep the current list when offline */
        })
      }),
    [],
  )

  return { products, loading, online, error, reload }
}