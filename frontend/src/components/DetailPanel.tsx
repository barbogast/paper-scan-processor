import { useRef, useEffect } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { Center, Loader } from '@mantine/core'
import * as pageCache from '../lib/pageCache'

const DETAIL_WIDTH = 1400

interface Props {
  pdfPath: string
  pageNum: number
  pageCount: number
  rotation?: number
  onToggleSkip?: () => void
  onRotate?: (delta: 90 | -90) => void
}

export default function DetailPanel({ pdfPath, pageNum, pageCount, rotation = 0, onToggleSkip, onRotate }: Props) {
  pageCache.usePageCacheRender()
  const transformRef = useRef<ReactZoomPanPinchRef>(null)

  useEffect(() => {
    pageCache.load(pdfPath, pageNum, DETAIL_WIDTH)
    if (pageNum > 1) pageCache.load(pdfPath, pageNum - 1, DETAIL_WIDTH) // prefetch previous page
    if (pageNum < pageCount) pageCache.load(pdfPath, pageNum + 1, DETAIL_WIDTH) // prefetch next page
  }, [pdfPath, pageNum, pageCount])

  useEffect(() => {
    transformRef.current?.resetTransform()
  }, [pageNum, rotation])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key.toLowerCase() !== 'r') return
      e.preventDefault()
      onRotate?.(e.shiftKey ? -90 : 90)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onRotate])

  const cachedWidth = pageCache.getCachedWidth(pdfPath, pageNum)
  const src = cachedWidth !== undefined && cachedWidth >= DETAIL_WIDTH
    ? pageCache.getSrc(pdfPath, pageNum)
    : undefined

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--mantine-color-gray-1)',
        padding: 8,
      }}
    >
      {pageCache.isLoading(pdfPath, pageNum) && (
        <Center style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Loader />
        </Center>
      )}
      {src && (
        <TransformWrapper ref={transformRef} centerOnInit minScale={0.1} maxScale={8}>
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <img
              src={src}
              alt={`Page ${pageNum}`}
              draggable={false}
              style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', userSelect: 'none', transform: rotation ? `rotate(${rotation}deg)` : undefined }}
            />
          </TransformComponent>
        </TransformWrapper>
      )}
    </div>
  )
}
