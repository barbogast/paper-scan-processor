import { useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box, Button, Group, Loader, Text } from '@mantine/core'
import { usePageLoader } from '../hooks/usePageLoader'
import { ITEM_PADDING, LABEL_HEIGHT, PAGE_ASPECT, DRAG_HANDLE_WIDTH, DEFAULT_WIDTH } from './ThumbnailPanel'

const MIN_TOTAL_WIDTH = 240
const MAX_TOTAL_WIDTH = 960
const DEFAULT_TOTAL_WIDTH = DEFAULT_WIDTH * 2

type FirstPageIn = 'a' | 'b'

interface Props {
  pathA: string | null
  countA: number
  pathB: string | null
  countB: number
  selectedPageA: number
  selectedPageB: number
  onSelectPageA: (page: number) => void
  onSelectPageB: (page: number) => void
  firstPageIn: FirstPageIn
  onChooseA: () => void
  onChooseB: () => void
}

function makePageNumberLabel(isFirst: boolean, countOther: number) {
  return (index: number) => {
    const n = index + 1
    if (n <= countOther) return isFirst ? 2 * n - 1 : 2 * n
    return 2 * countOther + (n - countOther)
  }
}

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

export default function MergeModeThumbnailPanel({
  pathA, countA, pathB, countB,
  selectedPageA, selectedPageB, onSelectPageA, onSelectPageB,
  firstPageIn, onChooseA, onChooseB,
}: Props) {
  const [totalWidth, setTotalWidth] = useState(DEFAULT_TOTAL_WIDTH)
  const colWidth = Math.floor(totalWidth / 2)
  const thumbWidth = colWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  const itemHeight = thumbHeight + LABEL_HEIGHT + ITEM_PADDING

  const bothLoaded = pathA !== null && pathB !== null
  const halfThumbHeight = Math.round(thumbHeight / 2)
  const offsetA = bothLoaded && firstPageIn === 'b' ? halfThumbHeight : 0
  const offsetB = bothLoaded && firstPageIn === 'a' ? halfThumbHeight : 0

  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizerA = useVirtualizer({
    count: countA,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 3,
    paddingStart: offsetA,
  })

  const virtualizerB = useVirtualizer({
    count: countB,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 3,
    paddingStart: offsetB,
  })

  useEffect(() => {
    virtualizerA.measure()
    virtualizerB.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemHeight])

  const totalHeight = Math.max(virtualizerA.getTotalSize(), virtualizerB.getTotalSize(), 0)

  const { getSrc: getSrcA, isLoading: isLoadingA, load: loadA, invalidate: invalidateA } = usePageLoader(pathA ?? '', thumbWidth)
  const { getSrc: getSrcB, isLoading: isLoadingB, load: loadB, invalidate: invalidateB } = usePageLoader(pathB ?? '', thumbWidth)

  useEffect(() => {
    if (!pathA) return
    for (const item of virtualizerA.getVirtualItems()) loadA(item.index + 1)
  })
  useEffect(() => {
    if (!pathB) return
    for (const item of virtualizerB.getVirtualItems()) loadB(item.index + 1)
  })

  useEffect(() => {
    if (countA > 0) virtualizerA.scrollToIndex(selectedPageA - 1, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageA])
  useEffect(() => {
    if (countB > 0) virtualizerB.scrollToIndex(selectedPageB - 1, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageB])

  const aIsFirst = firstPageIn === 'a'
  const pageLabelA = bothLoaded ? makePageNumberLabel(aIsFirst, aIsFirst ? countB : countA) : undefined
  const pageLabelB = bothLoaded ? makePageNumberLabel(!aIsFirst, aIsFirst ? countA : countB) : undefined

  const startDrag = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = totalWidth
    const clamp = (w: number) => Math.max(MIN_TOTAL_WIDTH, Math.min(MAX_TOTAL_WIDTH, w))

    const onMove = (ev: MouseEvent) => setTotalWidth(clamp(startWidth + ev.clientX - startX))
    const onUp = (ev: MouseEvent) => {
      setTotalWidth(clamp(startWidth + ev.clientX - startX))
      invalidateA()
      invalidateB()
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
        {/* Column headers */}
        <Box style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <ColumnHeader label="File A" path={pathA} width={colWidth} onChoose={onChooseA} borderRight />
          <ColumnHeader label="File B" path={pathB} width={colWidth} onChoose={onChooseB} />
        </Box>

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
            {/* Column A */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: colWidth, height: '100%' }}>
              {virtualizerA.getVirtualItems().map(item => {
                const page = item.index + 1
                const src = getSrcA(page)
                const isSelected = page === selectedPageA
                return (
                  <div
                    key={item.key}
                    onClick={() => onSelectPageA(page)}
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
                        <img src={src} alt={`A page ${page}`} style={{ width: '100%', display: 'block' }} draggable={false} />
                      ) : (
                        <div style={{ width: '100%', height: thumbHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {pathA && isLoadingA(page) && <Loader size="xs" />}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--mantine-color-gray-7)', height: LABEL_HEIGHT, lineHeight: `${LABEL_HEIGHT}px` }}>
                      {pageLabelA ? pageLabelA(item.index) : page}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Column B */}
            <div style={{ position: 'absolute', left: colWidth, top: 0, width: colWidth, height: '100%' }}>
              {virtualizerB.getVirtualItems().map(item => {
                const page = item.index + 1
                const src = getSrcB(page)
                const isSelected = page === selectedPageB
                return (
                  <div
                    key={item.key}
                    onClick={() => onSelectPageB(page)}
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
                        <img src={src} alt={`B page ${page}`} style={{ width: '100%', display: 'block' }} draggable={false} />
                      ) : (
                        <div style={{ width: '100%', height: thumbHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {pathB && isLoadingB(page) && <Loader size="xs" />}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--mantine-color-gray-7)', height: LABEL_HEIGHT, lineHeight: `${LABEL_HEIGHT}px` }}>
                      {pageLabelB ? pageLabelB(item.index) : page}
                    </div>
                  </div>
                )
              })}
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

function ColumnHeader({
  label, path, width, onChoose, borderRight,
}: {
  label: string
  path: string | null
  width: number
  onChoose: () => void
  borderRight?: boolean
}) {
  return (
    <Box
      style={{
        width,
        flexShrink: 0,
        padding: '6px 8px',
        borderRight: borderRight ? '1px solid var(--mantine-color-gray-3)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <Group justify="space-between" gap={4} wrap="nowrap">
        <Text size="xs" c="dimmed">{label}</Text>
        <Button size="xs" variant="default" onClick={onChoose}>Choose…</Button>
      </Group>
      <Text
        size="xs"
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={path ?? undefined}
      >
        {path ? basename(path) : '—'}
      </Text>
    </Box>
  )
}
