import { RenderPage } from '../../wailsjs/go/main/App'

interface Entry { src: string; width: number }

const entries = new Map<string, Entry>()
const loading = new Set<string>()
const failed = new Set<string>()
const listeners = new Set<() => void>()

const pk = (path: string, page: number) => `${path}\0${page}`

function notify() {
  for (const fn of listeners) fn()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSrc(path: string, page: number): string | undefined {
  return entries.get(pk(path, page))?.src
}

export function isLoading(path: string, page: number): boolean {
  return loading.has(pk(path, page))
}

export function isFailed(path: string, page: number): boolean {
  return failed.has(pk(path, page))
}

export function load(path: string, page: number, width: number): void {
  if (!path) return
  const k = pk(path, page)
  const existing = entries.get(k)
  if (existing && existing.width >= width) return
  if (loading.has(k)) return
  if (failed.has(k)) return
  console.log('load!', path, page, width)
  loading.add(k)
  RenderPage(path, page, Math.round(width * window.devicePixelRatio))
    .then((b64) => {
      entries.set(k, { src: `data:image/png;base64,${b64}`, width })
      loading.delete(k)
      console.log('load success', path, page, width)
      notify()
    })
    .catch((err) => {
      console.error(`RenderPage failed for page ${page}:`, err)
      loading.delete(k)
      failed.add(k)
      notify()
    })
}

export function evict(path: string): void {
  console.log('evict', path)
  const prefix = path + '\0'
  for (const k of [...entries.keys()]) if (k.startsWith(prefix)) entries.delete(k)
  for (const k of [...failed]) if (k.startsWith(prefix)) failed.delete(k)
  notify()
}
