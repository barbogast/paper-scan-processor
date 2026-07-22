import { useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box } from '@mantine/core'
import * as pageCache from '../../lib/pageCache'
import { PDFFile } from './usePDFFile'
import { makeResizeDragHandler } from '../../lib/resizableWidth'
import { DEFAULT_WIDTH, ITEM_PADDING, LABEL_HEIGHT, PAGE_ASPECT } from '../../constants'
import PageThumbnail from '../PageThumbnail'
import ResizeHandle from '../ResizeHandle'

const MIN_TOTAL_WIDTH = 240
const MAX_TOTAL_WIDTH = 960
export const DEFAULT_TOTAL_WIDTH = DEFAULT_WIDTH * 2

export type FirstPageIn = 'a' | 'b'
export type SelectedPage = { file: FirstPageIn, page: number }

interface Props {
  fileA: PDFFile
  fileB: PDFFile
  selectedPage: SelectedPage
  onSelectPage: (file: FirstPageIn, page: number) => void
  firstPageIn: FirstPageIn
  totalWidth: number
  onWidthChange: (w: number) => void
  colWidth: number
  reverseB: boolean
}

function makePageNumberLabel(isFirst: boolean, countOther: number) {
  return (index: number) => {
    const n = index + 1
    if (n <= countOther) return isFirst ? 2 * n - 1 : 2 * n
    return 2 * countOther + (n - countOther)
  }
}

export default function MergeModeThumbnailPanel({
  fileA, fileB,
  selectedPage, onSelectPage,
  firstPageIn, totalWidth, onWidthChange, colWidth, reverseB,
}: Props) {
  const selectedPageA = selectedPage.file === 'a' ? selectedPage.page : null
  const selectedPageB = selectedPage.file === 'b' ? selectedPage.page : null
  const thumbWidth = colWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const itemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING

  const bothLoaded = fileA.path !== null && fileB.path !== null
  const halfThumbHeight = Math.round(thumbHeight / 2)
  const offsetA = bothLoaded && firstPageIn === 'b' ? halfThumbHeight : 0
  const offsetB = bothLoaded && firstPageIn === 'a' ? halfThumbHeight : 0

  const totalHeight = Math.max(offsetA + fileA.count * itemHeight, offsetB + fileB.count * itemHeight, 0)

  const scrollRef = useRef<HTMLDivElement>(null)

  pageCache.usePageCacheRender()

  const aIsFirst = firstPageIn === 'a'
  const pageLabelA = bothLoaded ? makePageNumberLabel(aIsFirst, aIsFirst ? fileB.count : fileA.count) : undefined
  const pageLabelB = bothLoaded ? makePageNumberLabel(!aIsFirst, aIsFirst ? fileA.count : fileB.count) : undefined

  const startDrag = makeResizeDragHandler(totalWidth, onWidthChange, MIN_TOTAL_WIDTH, MAX_TOTAL_WIDTH)

  return (
    <Box style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      <Box style={{ display: 'flex', flexDirection: 'column', width: totalWidth, height: '100%' }}>
        {/* Single scroll area with two absolute columns */}
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
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: colWidth, height: '100%' }}>
              <ThumbColumn
                scrollRef={scrollRef}
                file={fileA}
                pdfPath={fileA.path ?? ''}
                itemHeight={itemHeight}
                paddingStart={offsetA}
                thumbWidth={thumbWidth}
                thumbHeight={thumbHeight}
                selectedPage={selectedPageA}
                onSelectPage={(page) => onSelectPage('a', page)}
                pageLabel={pageLabelA}
              />
            </div>
            <div style={{ position: 'absolute', left: colWidth, top: 0, width: colWidth, height: '100%' }}>
              <ThumbColumn
                scrollRef={scrollRef}
                file={fileB}
                pdfPath={fileB.path ?? ''}
                itemHeight={itemHeight}
                paddingStart={offsetB}
                thumbWidth={thumbWidth}
                thumbHeight={thumbHeight}
                selectedPage={selectedPageB}
                onSelectPage={(page) => onSelectPage('b', page)}
                pageLabel={pageLabelB}
                reverse={reverseB}
              />
            </div>
          </div>
        </div>
      </Box>

      <ResizeHandle onMouseDown={startDrag} />
    </Box>
  )
}

interface ThumbColumnProps {
  scrollRef: React.RefObject<HTMLDivElement | null>
  file: PDFFile
  pdfPath: string
  itemHeight: number
  paddingStart: number
  thumbWidth: number
  thumbHeight: number
  selectedPage: number | null
  onSelectPage: (page: number) => void
  pageLabel?: (index: number) => number
  reverse?: boolean
}

function ThumbColumn({
  scrollRef, file, pdfPath, itemHeight, paddingStart,
  thumbWidth, thumbHeight,
  selectedPage, onSelectPage, pageLabel,
  reverse,
}: ThumbColumnProps) {
  const { count, skipped, rotations, toggleSkip, rotate } = file
  const pageAt = (index: number) => reverse ? count - index : index + 1
  const [hoveredPage, setHoveredPage] = useState<number | null>(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 3,
    paddingStart,
  })

  useEffect(() => {
    virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemHeight])

  // Keyed on the visible range so this only re-runs when scroll position, data, or
  // sizing actually change — not on unrelated re-renders like hover state.
  useEffect(() => {
    for (const item of virtualizer.getVirtualItems()) pageCache.load(pdfPath, pageAt(item.index), thumbWidth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualizer.range?.startIndex, virtualizer.range?.endIndex, pdfPath, thumbWidth, reverse, count])

  useEffect(() => {
    if (selectedPage !== null && count > 0) {
      const displayIndex = reverse ? count - selectedPage : selectedPage - 1
      virtualizer.scrollToIndex(displayIndex, { align: 'auto' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage])

  return (
    <>
      {virtualizer.getVirtualItems().map(item => {
        const page = pageAt(item.index)
        return (
          <div
            key={item.key}
            onMouseEnter={() => setHoveredPage(page)}
            onMouseLeave={() => setHoveredPage(null)}
            style={{
              position: 'absolute',
              top: item.start,
              left: 0,
              width: '100%',
              height: item.size,
              boxSizing: 'border-box',
            }}
          >
            <PageThumbnail
              src={pageCache.getSrc(pdfPath, page)}
              pdfPath={pdfPath}
              page={page}
              thumbHeight={thumbHeight}
              isSelected={page === selectedPage}
              isSkipped={skipped.has(page)}
              rotation={rotations.get(page) ?? 0}
              isHovered={hoveredPage === page}
              label={String(pageLabel ? pageLabel(item.index) : page)}
              onClick={() => onSelectPage(page)}
              onRotate={() => rotate(page)}
              onToggleSkip={() => toggleSkip(page)}
            />
          </div>
        )
      })}
    </>
  )
}
    

