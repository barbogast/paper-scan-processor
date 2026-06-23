import { useRef, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as pageCache from '../../hooks/pageCache'
import { DEFAULT_WIDTH, DRAG_HANDLE_WIDTH, ITEM_PADDING, PAGE_ASPECT, LABEL_HEIGHT, HEADER_HEIGHT } from '../../constants'
import PageThumbnail from '../PageThumbnail'
import type { OutputFilesHandle } from './useOutputFiles'
import OutputFileHeader from './OutputFileHeader'
import type { PendingFocusHandle } from './usePendingFocus'

const MIN_WIDTH = 120
const MAX_WIDTH = 480
const GAP_HEIGHT = 16

type ListItem =
  | { type: 'header'; fileIndex: number; firstPage: number }
  | { type: 'page'; page: number }

function buildItems(pageCount: number, splitPoints: Set<number>): ListItem[] {
  const result: ListItem[] = []
  let fileIndex = 0
  for (let page = 1; page <= pageCount; page++) {
    if (page === 1 || splitPoints.has(page - 1)) {
      result.push({ type: 'header', fileIndex: fileIndex++, firstPage: page })
    }
    result.push({ type: 'page', page })
  }
  return result
}

interface Props {
  pdfPath: string
  pageCount: number
  selectedPage: number
  onSelectPage: (page: number) => void
  onToggleSplitPoint: (afterPage: number) => void
  outputFiles: OutputFilesHandle
  outputFolder: string | null
  focus: PendingFocusHandle
  rotations: Map<number, number>
  onRotate: (page: number) => void
  skipped: Set<number>
  onToggleSkip: (page: number) => void
}

export default function SplitThumbnailPanel({
  pdfPath, pageCount, selectedPage, onSelectPage,
  onToggleSplitPoint,
  outputFiles,
  outputFolder,
  focus,
  rotations,
  onRotate,
  skipped,
  onToggleSkip,
}: Props) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const [hoveredGap, setHoveredGap] = useState<number | null>(null)
  const [hoveredPage, setHoveredPage] = useState<number | null>(null)

  const thumbWidth = panelWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const pageItemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING + GAP_HEIGHT

  const splitPoints = useMemo(() => outputFiles.getSplitPoints(), [outputFiles.all])
  const items = useMemo(() => buildItems(pageCount, splitPoints), [pageCount, splitPoints])
  // Ref so the scroll effect can read the current list without depending on it
  // (we don't want to re-scroll every time a split point is toggled).
  const itemsRef = useRef(items)
  itemsRef.current = items

  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => items[index]?.type === 'header' ? HEADER_HEIGHT : pageItemHeight,
    overscan: 3,
  })

  useEffect(() => {
    virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, pageItemHeight])

  const virtualItems = virtualizer.getVirtualItems()
  pageCache.usePageCacheRender()

  useEffect(() => {
    for (const vItem of virtualItems) {
      const item = items[vItem.index]
      if (item.type === 'page') pageCache.load(pdfPath, item.page, thumbWidth)
    }
  })

  useEffect(() => {
    const index = itemsRef.current.findIndex(item => item.type === 'page' && item.page === selectedPage)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' })
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
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onToggleSkip(selectedPage)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPage, pageCount, onSelectPage, onToggleSkip])

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
            {virtualItems.map(vItem => {
              const item = items[vItem.index]

              if (item.type === 'header') {
                return (
                  <div
                    key={vItem.key}
                    style={{ position: 'absolute', top: vItem.start, left: 0, width: '100%', height: vItem.size }}
                  >
                    <OutputFileHeader
                      filename={outputFiles.all.get(item.firstPage)?.name ?? ''}
                      onChange={(name) => outputFiles.setName(item.firstPage, name)}
                      firstPage={item.firstPage}
                      focus={focus}
                      folder={outputFiles.all.get(item.firstPage)?.folderOverride ?? outputFolder}
                      onPickFolder={() => outputFiles.pickFolderOverride(item.firstPage)}
                      isDuplicate={outputFiles.duplicateFirstPages.has(item.firstPage)}
                    />
                  </div>
                )
              }

              const page = item.page
              const isSplit = splitPoints.has(page)
              const isLastPage = page === pageCount

              return (
                <div
                  key={vItem.key}
                  style={{
                    position: 'absolute',
                    top: vItem.start,
                    left: 0,
                    width: '100%',
                    height: vItem.size,
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={() => setHoveredPage(page)}
                  onMouseLeave={() => setHoveredPage(null)}
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
                    label={String(page)}
                    onClick={() => onSelectPage(page)}
                    onRotate={() => onRotate(page)}
                    onToggleSkip={() => onToggleSkip(page)}
                  />
                  {!isLastPage && (
                    <GapZone
                      isSplit={isSplit}
                      isHovered={hoveredGap === page}
                      onClick={(e) => { e.stopPropagation(); onToggleSplitPoint(page) }}
                      onMouseEnter={() => setHoveredGap(page)}
                      onMouseLeave={() => setHoveredGap(null)}
                    />
                  )}
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

interface GapZoneProps {
  isSplit: boolean
  isHovered: boolean
  onClick: (e: React.MouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function GapZone({ isSplit, isHovered, onClick, onMouseEnter, onMouseLeave }: GapZoneProps) {
  const bg = isSplit
    ? 'var(--mantine-color-blue-0)'
    : isHovered
    ? 'var(--mantine-color-gray-2)'
    : undefined

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        height: GAP_HEIGHT,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: ITEM_PADDING,
        paddingRight: ITEM_PADDING,
        cursor: 'pointer',
      }}
    >
      {isSplit && (
        <div style={{ flex: 1, height: 2, background: 'var(--mantine-color-blue-5)', borderRadius: 1 }} />
      )}
      {!isSplit && isHovered && (
        <div style={{ flex: 1, height: 0, borderTop: '1px dashed var(--mantine-color-gray-5)' }} />
      )}
    </div>
  )
}
