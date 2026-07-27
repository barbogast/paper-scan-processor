import { useRef, useEffect } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { Center, Loader } from '@mantine/core'
import * as pageCache from '../lib/pageCache'
import styles from './DetailPanel.module.css'

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
    <div className={styles.panel}>
      {pageCache.isLoading(pdfPath, pageNum) && (
        <Center className={styles.loaderCenter}>
          <Loader />
        </Center>
      )}
      {src && (
        <TransformWrapper ref={transformRef} centerOnInit minScale={0.1} maxScale={8}>
          <TransformComponent wrapperClass={styles.wrapper} contentClass={styles.content}>
            <img
              src={src}
              alt={`Page ${pageNum}`}
              draggable={false}
              className={styles.image}
              style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
            />
          </TransformComponent>
        </TransformWrapper>
      )}
    </div>
  )
}
