import { useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box, Text } from '@mantine/core'
import * as pageCache from '../../lib/pageCache'
import { makeResizeDragHandler } from '../../lib/resizableWidth'
import { DEFAULT_WIDTH, DRAG_HANDLE_WIDTH, ITEM_PADDING, LABEL_HEIGHT, PAGE_ASPECT } from '../../constants'
import PageThumbnail from '../PageThumbnail'

const MIN_WIDTH = 120
const MAX_WIDTH = 480

interface Props {
  pdfPath: string | null
  pageCount: number
  selectedPage: number
  onSelectPage: (page: number) => void
}

// Read-only single-file thumbnail strip for the Drive Upload preview - unlike
// SplitMode/MergeMode's panels, there's no rotate/skip/reorder here since
// Drive Upload doesn't edit pages, just files to their destination.
export default function DriveThumbnailPanel({ pdfPath, pageCount, selectedPage, onSelectPage }: Props) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const startDrag = makeResizeDragHandler(panelWidth, setPanelWidth, MIN_WIDTH, MAX_WIDTH)
  const thumbWidth = panelWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const itemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING

  const scrollRef = useRef<HTMLDivElement>(null)
  pageCache.usePageCacheRender()

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 3,
  })

  useEffect(() => {
    virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemHeight, pageCount])

  // Keyed on the visible range so this only re-runs when scroll position, data, or
  // sizing actually change - same technique as the other ThumbnailPanels.
  useEffect(() => {
    if (!pdfPath) return
    for (const item of virtualizer.getVirtualItems()) pageCache.load(pdfPath, item.index + 1, thumbWidth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualizer.range?.startIndex, virtualizer.range?.endIndex, pdfPath, thumbWidth])

  useEffect(() => {
    if (pageCount > 0) virtualizer.scrollToIndex(selectedPage - 1, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage])

  useEffect(() => {
    if (!pdfPath) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' && selectedPage > 1) { e.preventDefault(); onSelectPage(selectedPage - 1) }
      else if (e.key === 'ArrowRight' && selectedPage < pageCount) { e.preventDefault(); onSelectPage(selectedPage + 1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pdfPath, selectedPage, pageCount, onSelectPage])

  return (
    <Box style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      <Box style={{ width: panelWidth, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {!pdfPath ? (
          <Box
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--mantine-color-gray-1)',
            }}
          >
            <Text size="sm" c="dimmed">Select a file to preview</Text>
          </Box>
        ) : (
          <div
            ref={scrollRef}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', background: 'var(--mantine-color-gray-3)' }}
          >
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(item => {
                const page = item.index + 1
                return (
                  <div
                    key={item.key}
                    style={{ position: 'absolute', top: item.start, left: 0, width: '100%', height: item.size }}
                  >
                    <PageThumbnail
                      src={pageCache.getSrc(pdfPath, page)}
                      pdfPath={pdfPath}
                      page={page}
                      thumbHeight={thumbHeight}
                      isSelected={page === selectedPage}
                      isSkipped={false}
                      rotation={0}
                      isHovered={false}
                      label={String(page)}
                      onClick={() => onSelectPage(page)}
                      onRotate={() => {}}
                      onToggleSkip={() => {}}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Box>

      <div
        onMouseDown={startDrag}
        style={{ width: DRAG_HANDLE_WIDTH, height: '100%', cursor: 'col-resize', flexShrink: 0, background: 'var(--mantine-color-gray-3)' }}
      />
    </Box>
  )
}
