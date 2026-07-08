import { useRef, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as pageCache from '../../lib/pageCache'
import { makeResizeDragHandler } from '../../lib/resizableWidth'
import { DEFAULT_WIDTH, DRAG_HANDLE_WIDTH, ITEM_PADDING, PAGE_ASPECT, LABEL_HEIGHT, HEADER_HEIGHT } from '../../constants'
import PageThumbnail from '../PageThumbnail'
import type { OutputFilesHandle } from './useOutputFiles'
import OutputFileHeader from './OutputFileHeader'
import type { PendingFocusHandle } from './usePendingFocus'

const MIN_WIDTH = 120
const MAX_WIDTH = 480
const GAP_HEIGHT = 16

type ListItem =
  | { type: 'header'; fileIndex: number; firstPosition: number }
  | { type: 'page'; page: number; position: number }

function buildItems(pageOrder: number[], splitPoints: Set<number>): ListItem[] {
  const result: ListItem[] = []
  let fileIndex = 0
  for (let pos = 0; pos < pageOrder.length; pos++) {
    if (pos === 0 || splitPoints.has(pos - 1)) {
      result.push({ type: 'header', fileIndex: fileIndex++, firstPosition: pos })
    }
    result.push({ type: 'page', page: pageOrder[pos], position: pos })
  }
  return result
}

interface Props {
  pdfPath: string
  pageOrder: number[]
  selectedPage: number
  onSelectPage: (page: number) => void
  onToggleSplitPoint: (afterPosition: number) => void
  outputFiles: OutputFilesHandle
  outputFolder: string | null
  focus: PendingFocusHandle
  rotations: Map<number, number>
  onRotate: (page: number) => void
  skipped: Set<number>
  onToggleSkip: (page: number) => void
  onMovePage: (fromPos: number, toPos: number) => void
}

export default function SplitThumbnailPanel({
  pdfPath, pageOrder, selectedPage, onSelectPage,
  onToggleSplitPoint,
  outputFiles,
  outputFolder,
  focus,
  rotations,
  onRotate,
  skipped,
  onToggleSkip,
  onMovePage,
}: Props) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const startDrag = makeResizeDragHandler(panelWidth, setPanelWidth, MIN_WIDTH, MAX_WIDTH)
  const [hoveredGap, setHoveredGap] = useState<number | null>(null)
  const [hoveredPage, setHoveredPage] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const thumbWidth = panelWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const pageItemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING + GAP_HEIGHT

  const splitPoints = useMemo(() => outputFiles.getSplitPoints(), [outputFiles.all])
  const items = useMemo(() => buildItems(pageOrder, splitPoints), [pageOrder, splitPoints])
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

  // Keyed on the visible range (not virtualItems itself, which is a fresh array every
  // render) so this only re-runs when scroll position, data, or sizing actually change —
  // not on unrelated re-renders like hover state.
  useEffect(() => {
    for (const vItem of virtualItems) {
      const item = items[vItem.index]
      if (item.type === 'page') pageCache.load(pdfPath, item.page, thumbWidth)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualizer.range?.startIndex, virtualizer.range?.endIndex, items, pdfPath, thumbWidth])

  useEffect(() => {
    const index = itemsRef.current.findIndex(item => item.type === 'page' && item.page === selectedPage)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const selectedPos = pageOrder.indexOf(selectedPage)
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (selectedPos > 0) onSelectPage(pageOrder[selectedPos - 1])
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (selectedPos < pageOrder.length - 1) onSelectPage(pageOrder[selectedPos + 1])
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onToggleSkip(selectedPage)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPage, pageOrder, onSelectPage, onToggleSkip])

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const fromPos = pageOrder.indexOf(active.id as number)
    const toPos = pageOrder.indexOf(over.id as number)
    if (fromPos !== -1 && toPos !== -1) onMovePage(fromPos, toPos)
  }

  return (
    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: panelWidth, height: '100%' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id as number)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pageOrder} strategy={verticalListSortingStrategy}>
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
                          filename={outputFiles.all.get(item.firstPosition)?.name ?? ''}
                          onChange={(name) => outputFiles.setName(item.firstPosition, name)}
                          firstPosition={item.firstPosition}
                          focus={focus}
                          folder={outputFiles.all.get(item.firstPosition)?.folderOverride ?? outputFolder}
                          onPickFolder={() => outputFiles.pickFolderOverride(item.firstPosition)}
                          isDuplicate={outputFiles.duplicateFirstPages.has(item.firstPosition)}
                        />
                      </div>
                    )
                  }

                  const { page, position } = item
                  const isSplit = splitPoints.has(position)
                  const isLastPage = position === pageOrder.length - 1

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
                      <SortablePageItem id={page}>
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
                          canMoveUp={position > 0}
                          canMoveDown={!isLastPage}
                          onMoveUp={() => onMovePage(position, position - 1)}
                          onMoveDown={() => onMovePage(position, position + 1)}
                        />
                      </SortablePageItem>
                      {!isLastPage && (
                        <GapZone
                          isSplit={isSplit}
                          isHovered={hoveredGap === position}
                          onClick={(e) => { e.stopPropagation(); onToggleSplitPoint(position) }}
                          onMouseEnter={() => setHoveredGap(position)}
                          onMouseLeave={() => setHoveredGap(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId !== null && (
              <PageThumbnail
                src={pageCache.getSrc(pdfPath, activeId)}
                pdfPath={pdfPath}
                page={activeId}
                thumbHeight={thumbHeight}
                isSelected={false}
                isSkipped={skipped.has(activeId)}
                rotation={rotations.get(activeId) ?? 0}
                isHovered={false}
                label={String(activeId)}
                onClick={() => {}}
                onRotate={() => {}}
                onToggleSkip={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
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

function SortablePageItem({ id, children }: { id: number; children: React.ReactNode }) {
  const { setNodeRef, transform, isDragging, attributes, listeners } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), opacity: isDragging ? 0 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
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
    <button
      type="button"
      aria-label={isSplit ? 'Remove split point here' : 'Add split point here'}
      aria-pressed={isSplit}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: '100%',
        height: GAP_HEIGHT,
        background: bg,
        border: 'none',
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
    </button>
  )
}
