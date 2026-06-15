import { useRef, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader } from '@mantine/core'
import { RenderPage } from '../../wailsjs/go/main/App'

const MIN_WIDTH = 120
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 220
const ITEM_PADDING = 8
const LABEL_HEIGHT = 20
// DIN A4 portrait aspect ratio (210 × 297 mm)
const PAGE_ASPECT = 297 / 210

interface Props {
  pdfPath: string
  pageCount: number
  selectedPage: number   // 1-indexed
  onSelectPage: (page: number) => void
}

export default function ThumbnailPanel({ pdfPath, pageCount, selectedPage, onSelectPage }: Props) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)

  const thumbWidth = panelWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const itemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING * 2

  const scrollRef = useRef<HTMLDivElement>(null)
  const cacheRef = useRef(new Map<number, string>())
  const loadingRef = useRef(new Set<number>())
  const failedRef = useRef(new Set<number>())
  const [, setTick] = useState(0)

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 3,
  })

  // Re-estimate row heights when panel is resized
  useEffect(() => {
    virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemHeight])

  // Invalidate thumbnail cache when the PDF changes
  useEffect(() => { 
    cacheRef.current.clear()
    loadingRef.current.clear()
    failedRef.current.clear()
    setTick(t => t + 1)
  }, [pdfPath])

  // Load thumbnails for currently visible items — runs after every render so it
  // picks up new virtual items as the user scrolls without needing a dep array.
  const virtualItems = virtualizer.getVirtualItems()
  useEffect(() => {
    for (const item of virtualItems) {
      const page = item.index + 1
      if (cacheRef.current.has(page) || loadingRef.current.has(page) || failedRef.current.has(page)) continue
      loadingRef.current.add(page)
      RenderPage(pdfPath, page, thumbWidth)
        .then(b64 => {
          cacheRef.current.set(page, `data:image/png;base64,${b64}`)
          loadingRef.current.delete(page)
          setTick(t => t + 1)
        })
        .catch(err => {
          console.error(`RenderPage failed for page ${page}:`, err)
          loadingRef.current.delete(page)
          failedRef.current.add(page)
          setTick(t => t + 1)
        })
    }
  })

  // Scroll selected page into view (e.g. after keyboard navigation)
  useEffect(() => {
    virtualizer.scrollToIndex(selectedPage - 1, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && selectedPage > 1) {
      e.preventDefault()
      onSelectPage(selectedPage - 1)
    } else if (e.key === 'ArrowRight' && selectedPage < pageCount) {
      e.preventDefault()
      onSelectPage(selectedPage + 1)
    }
  }, [selectedPage, pageCount, onSelectPage])

  const startDrag = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = panelWidth
    const clamp = (w: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))

    const onMove = (ev: MouseEvent) => setPanelWidth(clamp(startWidth + ev.clientX - startX))
    const onUp = (ev: MouseEvent) => {
      setPanelWidth(clamp(startWidth + ev.clientX - startX))
      cacheRef.current.clear()
      loadingRef.current.clear()
      failedRef.current.clear()
      setTick(t => t + 1)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }

  return (
    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          width: panelWidth,
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          outline: 'none',
        }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(item => {
            const page = item.index + 1
            const src = cacheRef.current.get(page)
            const isLoading = loadingRef.current.has(page)
            const isSelected = page === selectedPage

            return (
              <div
                key={item.key}
                style={{
                  position: 'absolute',
                  top: item.start,
                  left: 0,
                  width: '100%',
                  height: item.size,
                  padding: ITEM_PADDING,
                  paddingBottom: 0,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
                onClick={() => onSelectPage(page)}
              >
                <div
                  style={{
                    border: `2px solid ${isSelected ? 'var(--mantine-color-blue-5)' : 'transparent'}`,
                    borderRadius: 4,
                    overflow: 'hidden',
                    background: 'var(--mantine-color-gray-1)',
                  }}
                >
                  {src ? (
                    <img
                      src={src}
                      alt={`Page ${page}`}
                      style={{ width: '100%', display: 'block' }}
                      draggable={false}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: thumbHeight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isLoading && <Loader size="xs" />}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'var(--mantine-color-dimmed)',
                    height: LABEL_HEIGHT,
                    lineHeight: `${LABEL_HEIGHT}px`,
                  }}
                >
                  {page}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Resize drag handle */}
      <div
        onMouseDown={startDrag}
        style={{
          width: 4,
          height: '100%',
          cursor: 'col-resize',
          flexShrink: 0,
          background: 'var(--mantine-color-gray-3)',
        }}
      />
    </div>
  )
}
