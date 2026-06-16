import { useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box, Loader } from '@mantine/core'
import { PageLoader, usePageLoader } from '../../hooks/usePageLoader'
import { DEFAULT_WIDTH, DRAG_HANDLE_WIDTH, ITEM_PADDING, LABEL_HEIGHT, PAGE_ASPECT } from '../../constants'

const MIN_TOTAL_WIDTH = 240
const MAX_TOTAL_WIDTH = 960
export const DEFAULT_TOTAL_WIDTH = DEFAULT_WIDTH * 2

export type FirstPageIn = 'a' | 'b'
export type SelectedPage = { file: FirstPageIn, page: number }

interface Props {
  pathA: string | null
  countA: number
  pathB: string | null
  countB: number
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
  pathA, countA, pathB, countB,
  selectedPage, onSelectPage,
  firstPageIn, totalWidth, onWidthChange, colWidth, reverseB
}: Props) {
  const selectedPageA = selectedPage.file === 'a' ? selectedPage.page : null
  const selectedPageB = selectedPage.file === 'b' ? selectedPage.page : null
  const thumbWidth = colWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const itemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING

  const bothLoaded = pathA !== null && pathB !== null
  const halfThumbHeight = Math.round(thumbHeight / 2)
  const offsetA = bothLoaded && firstPageIn === 'b' ? halfThumbHeight : 0
  const offsetB = bothLoaded && firstPageIn === 'a' ? halfThumbHeight : 0

  const totalHeight = Math.max(offsetA + countA * itemHeight, offsetB + countB * itemHeight, 0)

  const scrollRef = useRef<HTMLDivElement>(null)

  const loaderA = usePageLoader(pathA ?? '', thumbWidth)
  const loaderB = usePageLoader(pathB ?? '', thumbWidth)

  const aIsFirst = firstPageIn === 'a'
  const pageLabelA = bothLoaded ? makePageNumberLabel(aIsFirst, aIsFirst ? countB : countA) : undefined
  const pageLabelB = bothLoaded ? makePageNumberLabel(!aIsFirst, aIsFirst ? countA : countB) : undefined

  const startDrag = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = totalWidth
    const clamp = (w: number) => Math.max(MIN_TOTAL_WIDTH, Math.min(MAX_TOTAL_WIDTH, w))

    const onMove = (ev: MouseEvent) => onWidthChange(clamp(startWidth + ev.clientX - startX))
    const onUp = (ev: MouseEvent) => {
      onWidthChange(clamp(startWidth + ev.clientX - startX))
      loaderA.invalidate()
      loaderB.invalidate()
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
                count={countA}
                itemHeight={itemHeight}
                paddingStart={offsetA}
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
                count={countB}
                itemHeight={itemHeight}
                paddingStart={offsetB}
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
  count: number
  itemHeight: number
  paddingStart: number
  thumbHeight: number
  loader: PageLoader
  selectedPage: number | null
  onSelectPage: (page: number) => void
  pageLabel?: (index: number) => number
  reverse?: boolean
}

function ThumbColumn({
  scrollRef, count, itemHeight, paddingStart,
  thumbHeight, loader,
  selectedPage, onSelectPage, pageLabel,
  reverse,
}: ThumbColumnProps) {
  const pageAt = (index: number) => reverse ? count - index : index + 1
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
    for (const item of virtualizer.getVirtualItems()) loader.load(pageAt(item.index))
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
    return (
      <div
        key={item.key}
        onClick={() => onSelectPage(page)}
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
          border: `2px solid ${isSelected ? 'var(--mantine-color-blue-5)' : 'transparent'}`,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--mantine-color-gray-1)',
        }}>
          {src ? (
            <img src={src} alt={`page ${page}`} style={{ width: '100%', display: 'block' }} draggable={false} />
          ) : (
            <div style={{ width: '100%', height: thumbHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loader.isLoading(page) && <Loader size="xs" />}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--mantine-color-gray-7)', height: LABEL_HEIGHT, lineHeight: `${LABEL_HEIGHT}px` }}>
          {pageLabel ? pageLabel(item.index) : page}
        </div>
      </div>
    )
  })
}
    

