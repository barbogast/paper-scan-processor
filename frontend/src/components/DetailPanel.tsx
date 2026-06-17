import { useRef, useEffect } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { Center, Loader } from '@mantine/core'
import { PageLoader } from '../hooks/usePageLoader'

const DETAIL_WIDTH = 1400

interface Props {
  pdfPath: string
  pageNum: number
  pageCount: number
  rotation?: number
  loader: PageLoader
  onNavigate: (page: number) => void
  onToggleSkip?: () => void
  onRotate?: () => void
}

export default function DetailPanel({ pdfPath, pageNum, pageCount, rotation = 0, loader, onNavigate, onToggleSkip, onRotate }: Props) {
  const { getSrc, isLoading, load } = loader
  const transformRef = useRef<ReactZoomPanPinchRef>(null)

  useEffect(() => {
    load(pageNum, DETAIL_WIDTH)
  }, [pdfPath, pageNum])

  useEffect(() => {
    transformRef.current?.resetTransform()
  }, [pageNum, rotation])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (pageNum > 1) onNavigate(pageNum - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (pageNum < pageCount) onNavigate(pageNum + 1)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onToggleSkip?.()
      } else if (e.key === 'r') {
        e.preventDefault()
        onRotate?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pageNum, pageCount, onNavigate, onToggleSkip, onRotate])

  const src = getSrc(pageNum)

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
      {isLoading(pageNum) && (
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
