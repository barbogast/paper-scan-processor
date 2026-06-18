import { useEffect, useState } from 'react'
import { RenderPage } from '../../wailsjs/go/main/App'

interface Entry { src: string; width: number }

// entries stores the best (highest-width) image loaded so far per page.
// loading tracks the width of the currently in-flight render per page; a higher-res
// request overwrites the value, which lets the stale lower-res .then know it was superseded.
// failed tracks the highest width that failed per page; retries at higher widths are still allowed.
const entries = new Map<string, Entry>()
const loading = new Map<string, number>()
const failed = new Map<string, number>()
const listeners = new Set<() => void>()

const pageKey = (path: string, page: number) => `${path}\0${page}`

function notify() {
  for (const fn of listeners) fn()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function usePageCacheRender() {
  const [, setTick] = useState(0)
  useEffect(() => subscribe(() => setTick(t => t + 1)), [])
}

export function getSrc(path: string, page: number): string | undefined {
  return entries.get(pageKey(path, page))?.src
}

export function getCachedWidth(path: string, page: number): number | undefined {
  return entries.get(pageKey(path, page))?.width
}

export function isLoading(path: string, page: number): boolean {
  return loading.has(pageKey(path, page))
}

export function isFailed(path: string, page: number): boolean {
  return failed.has(pageKey(path, page))
}

export function load(path: string, page: number, width: number): void {
  if (!path) return
  const k = pageKey(path, page)
  const existing = entries.get(k)
  if (existing && existing.width >= width) return
  const currentlyLoading = loading.get(k)
  // Don't start a new render if a higher-res one is already in-flight — it will supersede this one.
  if (currentlyLoading !== undefined && currentlyLoading >= width) return
  const failedAt = failed.get(k)
  if (failedAt !== undefined && failedAt >= width) return
  // Overwrite any lower-res in-flight entry. The superseded render will still complete but its
  // .then/.catch checks loading.get(k) === width before mutating state, so it becomes a no-op.
  loading.set(k, width)
  RenderPage(path, page, Math.round(width * window.devicePixelRatio))
    .then((b64) => {
      // A higher-res render may have completed while this one was in-flight — don't downgrade.
      const current = entries.get(k)
      if (!current || current.width <= width) {
        entries.set(k, { src: `data:image/png;base64,${b64}`, width })
      }
      // Only clear loading if we're still the active render (not superseded by a higher-res one).
      if (loading.get(k) === width) loading.delete(k)
      notify()
    })
    .catch(() => {
      if (loading.get(k) === width) {
        loading.delete(k)
        failed.set(k, width)
      }
      notify()
    })
}

export function evict(path: string): void {
  const prefix = path + '\0'
  for (const k of [...entries.keys()]) if (k.startsWith(prefix)) entries.delete(k)
  for (const k of [...loading.keys()]) if (k.startsWith(prefix)) loading.delete(k)
  for (const k of [...failed.keys()]) if (k.startsWith(prefix)) failed.delete(k)
  notify()
}
