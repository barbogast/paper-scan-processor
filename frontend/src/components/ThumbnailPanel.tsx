import { useRef, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader } from '@mantine/core'
import { usePageLoader } from '../hooks/usePageLoader'

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

  const virtualItems = virtualizer.getVirtualItems()
  const { getSrc, isLoading, load, invalidate } = usePageLoader(pdfPath, thumbWidth)

  useEffect(() => {
    for (const item of virtualItems) load(item.index + 1)
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
      invalidate()
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
            const src = getSrc(page)
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
                      {isLoading(page) && <Loader size="xs" />}
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
