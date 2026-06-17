import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader } from '@mantine/core'
import { usePageLoader } from '../../hooks/usePageLoader'
import { DEFAULT_WIDTH, DRAG_HANDLE_WIDTH, ITEM_PADDING, PAGE_ASPECT, LABEL_HEIGHT } from '../../constants'

const MIN_WIDTH = 120
const MAX_WIDTH = 480

const STRIP_LABEL_HEIGHT = 28

export interface ThumbnailPanelHandle {
  scrollTo: (top: number) => void
}

interface Props {
  pdfPath: string
  pageCount: number
  selectedPage: number   // 1-indexed
  onSelectPage: (page: number) => void
  label?: string
  width?: number
  hideDragHandle?: boolean
  onWidthChange?: (width: number) => void
  onScroll?: (scrollTop: number) => void
  hideScrollbar?: boolean
  topPadding?: number
  bottomPadding?: number
  pageNumberLabel?: (index: number) => number
}

const ThumbnailPanel = forwardRef<ThumbnailPanelHandle, Props>(function ThumbnailPanel(
  { pdfPath, pageCount, selectedPage, onSelectPage, label, width: controlledWidth, hideDragHandle, onWidthChange, onScroll, hideScrollbar, topPadding = 0, bottomPadding = 0, pageNumberLabel },
  ref,
) {
  const [internalWidth, setInternalWidth] = useState(DEFAULT_WIDTH)
  const panelWidth = controlledWidth ?? internalWidth

  const thumbWidth = panelWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const itemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING

  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 3,
    paddingStart: topPadding,
  })

  // Re-estimate row heights when panel is resized
  useEffect(() => {
    virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemHeight])

  const virtualItems = virtualizer.getVirtualItems()
  const { getSrc, isLoading, load, invalidate } = usePageLoader(pdfPath)

  useEffect(() => {
    for (const item of virtualItems) load(item.index + 1, thumbWidth)
  })

  // Scroll selected page into view (e.g. after keyboard navigation)
  useEffect(() => {
    virtualizer.scrollToIndex(selectedPage - 1, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage])

  useImperativeHandle(ref, () => ({
    scrollTo: (top) => { if (scrollRef.current) scrollRef.current.scrollTop = top },
  }))

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

    const onMove = (ev: MouseEvent) => {
      const w = clamp(startWidth + ev.clientX - startX)
      setInternalWidth(w)
      onWidthChange?.(w)
    }
    const onUp = (ev: MouseEvent) => {
      const w = clamp(startWidth + ev.clientX - startX)
      setInternalWidth(w)
      onWidthChange?.(w)
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
      <div style={{ display: 'flex', flexDirection: 'column', width: panelWidth, height: '100%' }}>
        {label && (
          <div
            style={{
              height: STRIP_LABEL_HEIGHT,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--mantine-color-dimmed)',
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            }}
          >
            {label}
          </div>
        )}
        <div
          ref={scrollRef}
          onScroll={(e) => onScroll?.(e.currentTarget.scrollTop)}
          className={hideScrollbar ? 'hide-scrollbar' : undefined}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--mantine-color-gray-3)',
          }}
        >
          <div style={{ height: virtualizer.getTotalSize() + bottomPadding, position: 'relative' }}>
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
                      color: 'var(--mantine-color-gray-7)',
                      height: LABEL_HEIGHT,
                      lineHeight: `${LABEL_HEIGHT}px`,
                    }}
                  >
                    {pageNumberLabel ? pageNumberLabel(item.index) : page}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Resize drag handle */}
      {!hideDragHandle && (
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
      )}
    </div>
  )
})

export default ThumbnailPanel
