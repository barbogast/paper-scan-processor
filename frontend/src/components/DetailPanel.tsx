import { useRef, useEffect, useCallback } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { Center, Loader } from '@mantine/core'
import { usePageLoader } from '../hooks/usePageLoader'

const DETAIL_WIDTH = 1400

interface Props {
  pdfPath: string
  pageNum: number
  pageCount: number
  rotation?: number
  onNavigate: (page: number) => void
  onToggleSkip?: () => void
  onRotate?: () => void
}

export default function DetailPanel({ pdfPath, pageNum, pageCount, rotation = 0, onNavigate, onToggleSkip, onRotate }: Props) {
  const { getSrc, isLoading, load } = usePageLoader(pdfPath, DETAIL_WIDTH)
  const transformRef = useRef<ReactZoomPanPinchRef>(null)

  useEffect(() => {
    load(pageNum)
  }, [pdfPath, pageNum])

  useEffect(() => {
    transformRef.current?.resetTransform()
  }, [pageNum, rotation])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && pageNum > 1) {
      e.preventDefault()
      onNavigate(pageNum - 1)
    } else if (e.key === 'ArrowRight' && pageNum < pageCount) {
      e.preventDefault()
      onNavigate(pageNum + 1)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && onToggleSkip) {
      e.preventDefault()
      onToggleSkip()
    } else if (e.key === 'r' && onRotate) {
      e.preventDefault()
      onRotate()
    }
  }, [pageNum, pageCount, onNavigate, onToggleSkip, onRotate])

  const src = getSrc(pageNum)

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        outline: 'none',
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
