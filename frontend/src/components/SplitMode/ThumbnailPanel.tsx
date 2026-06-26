import { useRef, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
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
  | { type: 'header'; segmentIndex: number }
  | { type: 'page'; page: number; displayIndex: number }

function buildItems(pageOrder: number[], splitPoints: Set<number>): ListItem[] {
  const result: ListItem[] = []
  let segmentIndex = 0
  for (let i = 0; i < pageOrder.length; i++) {
    if (i === 0 || splitPoints.has(i - 1)) {
      result.push({ type: 'header', segmentIndex: segmentIndex++ })
    }
    result.push({ type: 'page', page: pageOrder[i], displayIndex: i })
  }
  return result
}

interface Props {
  pdfPath: string
  pageCount: number
  pageOrder: number[]
  onReorder: (newOrder: number[]) => void
  selectedPage: number
  onSelectPage: (page: number) => void
  onToggleSplitPoint: (afterDisplayIndex: number) => void
  outputFiles: OutputFilesHandle
  outputFolder: string | null
  focus: PendingFocusHandle
  rotations: Map<number, number>
  onRotate: (page: number) => void
  skipped: Set<number>
  onToggleSkip: (page: number) => void
}

export default function SplitThumbnailPanel({
  pdfPath, pageCount, pageOrder, onReorder,
  selectedPage, onSelectPage,
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
  const [activeId, setActiveId] = useState<number | null>(null)
  const [draggingOrder, setDraggingOrder] = useState<number[] | null>(null)

  const thumbWidth = panelWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const pageItemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING + GAP_HEIGHT

  const displayOrder = draggingOrder ?? pageOrder
  const splitPoints = outputFiles.splitPoints
  const items = useMemo(() => buildItems(displayOrder, splitPoints), [displayOrder, splitPoints])
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
      const displayIndex = pageOrder.indexOf(selectedPage)
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (displayIndex > 0) onSelectPage(pageOrder[displayIndex - 1])
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (displayIndex < pageOrder.length - 1) onSelectPage(pageOrder[displayIndex + 1])
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onToggleSkip(selectedPage)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPage, pageOrder, onSelectPage, onToggleSkip])

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id))
    setDraggingOrder([...pageOrder])
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDraggingOrder(prev => {
      const order = prev ?? pageOrder
      const oldIndex = order.indexOf(Number(active.id))
      const newIndex = order.indexOf(Number(over.id))
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(order, oldIndex, newIndex)
    })
  }

  const handleDragEnd = (_event: DragEndEvent) => {
    if (draggingOrder) onReorder(draggingOrder)
    setActiveId(null)
    setDraggingOrder(null)
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setDraggingOrder(null)
  }

  const activePageSrc = activeId != null ? pageCache.getSrc(pdfPath, activeId) : undefined

  return (
    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: panelWidth, height: '100%' }}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={displayOrder.map(String)} strategy={verticalListSortingStrategy}>
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
                          filename={outputFiles.files[item.segmentIndex]?.name ?? ''}
                          onChange={(name) => outputFiles.setName(item.segmentIndex, name)}
                          segmentIndex={item.segmentIndex}
                          focus={focus}
                          folder={outputFiles.files[item.segmentIndex]?.folderOverride ?? outputFolder}
                          onPickFolder={() => outputFiles.pickFolderOverride(item.segmentIndex)}
                          isDuplicate={outputFiles.duplicates.has(item.segmentIndex)}
                        />
                      </div>
                    )
                  }

                  const { page, displayIndex } = item
                  const isLastPage = displayIndex === pageOrder.length - 1
                  const isSplit = splitPoints.has(displayIndex)

                  return (
                    <SortablePageItem
                      key={page}
                      virtualKey={vItem.key}
                      top={vItem.start}
                      size={vItem.size}
                      page={page}
                      displayIndex={displayIndex}
                      isDraggingThis={page === activeId}
                      pdfPath={pdfPath}
                      thumbHeight={thumbHeight}
                      isSelected={page === selectedPage}
                      isSkipped={skipped.has(page)}
                      rotation={rotations.get(page) ?? 0}
                      isHovered={hoveredPage === page}
                      onHoverEnter={() => setHoveredPage(page)}
                      onHoverLeave={() => setHoveredPage(null)}
                      onSelectPage={() => onSelectPage(page)}
                      onRotate={() => onRotate(page)}
                      onToggleSkip={() => onToggleSkip(page)}
                      isLastPage={isLastPage}
                      isSplit={isSplit}
                      isGapHovered={hoveredGap === displayIndex}
                      onGapClick={(e) => { e.stopPropagation(); onToggleSplitPoint(displayIndex) }}
                      onGapEnter={() => setHoveredGap(displayIndex)}
                      onGapLeave={() => setHoveredGap(null)}
                    />
                  )
                })}
              </div>
            </div>
          </SortableContext>

          <DragOverlay>
            {activeId != null && (
              <div style={{ opacity: 0.9 }}>
                <PageThumbnail
                  src={activePageSrc}
                  pdfPath={pdfPath}
                  page={activeId}
                  thumbHeight={thumbHeight}
                  isSelected={false}
                  isSkipped={skipped.has(activeId)}
                  rotation={rotations.get(activeId) ?? 0}
                  isHovered={true}
                  label={String(activeId)}
                  onClick={() => {}}
                  onRotate={() => {}}
                  onToggleSkip={() => {}}
                />
              </div>
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

interface SortablePageItemProps {
  virtualKey: React.Key
  top: number
  size: number
  page: number
  displayIndex: number
  isDraggingThis: boolean
  pdfPath: string
  thumbHeight: number
  isSelected: boolean
  isSkipped: boolean
  rotation: number
  isHovered: boolean
  onHoverEnter: () => void
  onHoverLeave: () => void
  onSelectPage: () => void
  onRotate: () => void
  onToggleSkip: () => void
  isLastPage: boolean
  isSplit: boolean
  isGapHovered: boolean
  onGapClick: (e: React.MouseEvent) => void
  onGapEnter: () => void
  onGapLeave: () => void
}

function SortablePageItem({
  virtualKey, top, size, page, isDraggingThis,
  pdfPath, thumbHeight, isSelected, isSkipped, rotation,
  isHovered, onHoverEnter, onHoverLeave, onSelectPage, onRotate, onToggleSkip,
  isLastPage, isSplit, isGapHovered, onGapClick, onGapEnter, onGapLeave,
}: SortablePageItemProps) {
  const { attributes, listeners, setNodeRef } = useSortable({ id: String(page) })

  return (
    <div
      ref={setNodeRef}
      key={virtualKey}
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: '100%',
        height: size,
        boxSizing: 'border-box',
        opacity: isDraggingThis ? 0 : 1,
      }}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <PageThumbnail
        src={pageCache.getSrc(pdfPath, page)}
        pdfPath={pdfPath}
        page={page}
        thumbHeight={thumbHeight}
        isSelected={isSelected}
        isSkipped={isSkipped}
        rotation={rotation}
        isHovered={isHovered}
        label={String(page)}
        onClick={onSelectPage}
        onRotate={onRotate}
        onToggleSkip={onToggleSkip}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
      {!isLastPage && (
        <GapZone
          isSplit={isSplit}
          isHovered={isGapHovered}
          onClick={onGapClick}
          onMouseEnter={onGapEnter}
          onMouseLeave={onGapLeave}
        />
      )}
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
