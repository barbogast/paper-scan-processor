import { useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box, Loader } from '@mantine/core'
import { IconX, IconRotateClockwise } from '@tabler/icons-react'
import { PageLoader, usePageLoader } from '../../hooks/usePageLoader'
import { PDFFile } from '../../hooks/usePDFFile'
import { DEFAULT_WIDTH, DRAG_HANDLE_WIDTH, ITEM_PADDING, LABEL_HEIGHT, PAGE_ASPECT } from '../../constants'

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

  const loaderA = usePageLoader(fileA.path ?? '')
  const loaderB = usePageLoader(fileB.path ?? '')

  const aIsFirst = firstPageIn === 'a'
  const pageLabelA = bothLoaded ? makePageNumberLabel(aIsFirst, aIsFirst ? fileB.count : fileA.count) : undefined
  const pageLabelB = bothLoaded ? makePageNumberLabel(!aIsFirst, aIsFirst ? fileA.count : fileB.count) : undefined

  const startDrag = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = totalWidth
    const clamp = (w: number) => Math.max(MIN_TOTAL_WIDTH, Math.min(MAX_TOTAL_WIDTH, w))

    const onMove = (ev: MouseEvent) => onWidthChange(clamp(startWidth + ev.clientX - startX))
    const onUp = (ev: MouseEvent) => {
      onWidthChange(clamp(startWidth + ev.clientX - startX))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }

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
                itemHeight={itemHeight}
                paddingStart={offsetA}
                thumbWidth={thumbWidth}
                thumbHeight={thumbHeight}
                loader={loaderA}
                selectedPage={selectedPageA}
                onSelectPage={(page) => onSelectPage('a', page)}
                pageLabel={pageLabelA}
              />
            </div>
            <div style={{ position: 'absolute', left: colWidth, top: 0, width: colWidth, height: '100%' }}>
              <ThumbColumn
                scrollRef={scrollRef}
                file={fileB}
                itemHeight={itemHeight}
                paddingStart={offsetB}
                thumbWidth={thumbWidth}
                thumbHeight={thumbHeight}
                loader={loaderB}
                selectedPage={selectedPageB}
                onSelectPage={(page) => onSelectPage('b', page)}
                pageLabel={pageLabelB}
                reverse={reverseB}
              />
            </div>
          </div>
        </div>
      </Box>

      {/* Resize drag handle */}
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
    </Box>
  )
}

interface ThumbColumnProps {
  scrollRef: React.RefObject<HTMLDivElement | null>
  file: PDFFile
  itemHeight: number
  paddingStart: number
  thumbWidth: number
  thumbHeight: number
  loader: PageLoader
  selectedPage: number | null
  onSelectPage: (page: number) => void
  pageLabel?: (index: number) => number
  reverse?: boolean
}

function ThumbColumn({
  scrollRef, file, itemHeight, paddingStart,
  thumbWidth, thumbHeight, loader,
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

  useEffect(() => {
    for (const item of virtualizer.getVirtualItems()) loader.load(pageAt(item.index), thumbWidth)
  })

  useEffect(() => {
    if (selectedPage !== null && count > 0) {
      const displayIndex = reverse ? count - selectedPage : selectedPage - 1
      virtualizer.scrollToIndex(displayIndex, { align: 'auto' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage])

  return virtualizer.getVirtualItems().map(item => {
    const page = pageAt(item.index)
    const src = loader.getSrc(page)
    const isSelected = page === selectedPage
    const isSkipped = skipped.has(page)
    const showSkipBtn = hoveredPage === page || isSkipped
    const rotation = rotations.get(page) ?? 0
    const isRotated = rotation !== 0
    const showRotateBtn = hoveredPage === page || isRotated
    const isOddRotation = rotation === 90 || rotation === 270
    const imgTransform = rotation ? `rotate(${rotation}deg)${isOddRotation ? ` scale(${210 / 297})` : ''}` : undefined
    return (
      <div
        key={item.key}
        onClick={() => onSelectPage(page)}
        onMouseEnter={() => setHoveredPage(page)}
        onMouseLeave={() => setHoveredPage(null)}
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
      >
        <div style={{
          position: 'relative',
          border: `2px solid ${isSelected ? 'var(--mantine-color-blue-5)' : 'transparent'}`,
          borderRadius: 4,
        }}>
          <div style={{ overflow: 'hidden', borderRadius: 2, background: 'var(--mantine-color-gray-1)' }}>
            {src ? (
              <img src={src} alt={`page ${page}`} style={{ width: '100%', display: 'block', opacity: isSkipped ? 0.3 : 1, transform: imgTransform }} draggable={false} />
            ) : (
              <div style={{ width: '100%', height: thumbHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loader.isLoading(page) && <Loader size="xs" />}
              </div>
            )}
          </div>
          {showRotateBtn && (
            <div
              onClick={(e) => { e.stopPropagation(); rotate(page) }}
              style={{
                position: 'absolute', top: 3, left: 3,
                width: 16, height: 16, borderRadius: 3,
                background: isRotated ? 'var(--mantine-color-blue-6)' : 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'white',
              }}
            >
              <IconRotateClockwise size={10} stroke={3} />
            </div>
          )}
          {showSkipBtn && (
            <div
              onClick={(e) => { e.stopPropagation(); toggleSkip(page) }}
              style={{
                position: 'absolute', top: 3, right: 3,
                width: 16, height: 16, borderRadius: 3,
                background: isSkipped ? 'var(--mantine-color-orange-6)' : 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'white',
              }}
            >
              <IconX size={10} stroke={3} />
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: isSkipped ? 'var(--mantine-color-gray-5)' : 'var(--mantine-color-gray-7)', height: LABEL_HEIGHT, lineHeight: `${LABEL_HEIGHT}px` }}>
          {pageLabel ? pageLabel(item.index) : page}
        </div>
      </div>
    )
  })
}
    

