import { useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader } from '@mantine/core'
import * as pageCache from '../../hooks/pageCache'
import { DEFAULT_WIDTH, DRAG_HANDLE_WIDTH, ITEM_PADDING, PAGE_ASPECT, LABEL_HEIGHT } from '../../constants'

const MIN_WIDTH = 120
const MAX_WIDTH = 480

interface Props {
  pdfPath: string
  pageCount: number
  selectedPage: number
  onSelectPage: (page: number) => void
}

export default function SplitThumbnailPanel({ pdfPath, pageCount, selectedPage, onSelectPage }: Props) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)

  const thumbWidth = panelWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const itemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING

  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 3,
  })

  useEffect(() => {
    virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemHeight])

  const virtualItems = virtualizer.getVirtualItems()
  pageCache.usePageCacheRender()

  useEffect(() => {
    for (const item of virtualItems) pageCache.load(pdfPath, item.index + 1, thumbWidth)
  })

  useEffect(() => {
    virtualizer.scrollToIndex(selectedPage - 1, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (selectedPage > 1) onSelectPage(selectedPage - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (selectedPage < pageCount) onSelectPage(selectedPage + 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPage, pageCount, onSelectPage])

  const startDrag = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = panelWidth
    const clamp = (w: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))
    const onMove = (ev: MouseEvent) => setPanelWidth(clamp(startWidth + ev.clientX - startX))
    const onUp = (ev: MouseEvent) => {
      setPanelWidth(clamp(startWidth + ev.clientX - startX))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }

  return (
    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: panelWidth, height: '100%' }}>
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--mantine-color-gray-3)',
          }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualItems.map(item => {
              const page = item.index + 1
              const src = pageCache.getSrc(pdfPath, page)
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
                        {pageCache.isLoading(pdfPath, page) && <Loader size="xs" />}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: 11,
                      color: 'var(--mantine-color-gray-7)',
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
      </div>

      <div
        onMouseDown={startDrag}
        style={{
          width: DRAG_HANDLE_WIDTH,
          height: '100%',
          cursor: 'col-resize',
          flexShrink: 0,
          background: 'var(--mantine-color-gray-3)',
        }}
      />
    </div>
  )
}
