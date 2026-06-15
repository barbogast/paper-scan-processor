import { useRef, useState, useEffect, useCallback } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { Center, Loader } from '@mantine/core'
import { RenderPage } from '../../wailsjs/go/main/App'

const DETAIL_WIDTH = 1400

interface Props {
  pdfPath: string
  pageNum: number
  pageCount: number
  onNavigate: (page: number) => void
}

export default function DetailPanel({ pdfPath, pageNum, pageCount, onNavigate }: Props) {
  const cacheRef = useRef(new Map<number, string>())
  const [src, setSrc] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const transformRef = useRef<ReactZoomPanPinchRef>(null)

  // Invalidate cache when PDF changes
  useEffect(() => {
    cacheRef.current.clear()
    setSrc(undefined)
  }, [pdfPath])

  // Load page when pageNum or pdfPath changes
  useEffect(() => {
    const cached = cacheRef.current.get(pageNum)
    if (cached) {
      setSrc(cached)
      transformRef.current?.resetTransform()
      return
    }
    setLoading(true)
    setSrc(undefined)
    RenderPage(pdfPath, pageNum, DETAIL_WIDTH)
      .then((b64: string) => {
        const dataUrl = `data:image/png;base64,${b64}`
        cacheRef.current.set(pageNum, dataUrl)
        setSrc(dataUrl)
        setLoading(false)
        transformRef.current?.resetTransform()
      })
      .catch((err: unknown) => {
        console.error(`DetailPanel RenderPage failed for page ${pageNum}:`, err)
        setLoading(false)
      })
  }, [pdfPath, pageNum])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && pageNum > 1) {
      e.preventDefault()
      onNavigate(pageNum - 1)
    } else if (e.key === 'ArrowRight' && pageNum < pageCount) {
      e.preventDefault()
      onNavigate(pageNum + 1)
    }
  }, [pageNum, pageCount, onNavigate])

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
      }}
    >
      {loading && (
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
              style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', userSelect: 'none' }}
            />
          </TransformComponent>
        </TransformWrapper>
      )}
    </div>
  )
}
