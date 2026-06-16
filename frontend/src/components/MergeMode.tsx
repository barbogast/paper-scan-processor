import { useRef, useState } from 'react'
import { Box, Button, Center, Group, SegmentedControl, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MergePDFs, OpenPDF, PageCount, SavePDF } from '../../wailsjs/go/main/App'
import ThumbnailPanel, {
  DEFAULT_WIDTH, DRAG_HANDLE_WIDTH, HALF_THUMB_HEIGHT,
  ITEM_PADDING, ITEM_GAP, LABEL_HEIGHT, PAGE_ASPECT,
  ThumbnailPanelHandle,
} from './ThumbnailPanel'
import MergeModeThumbnailPanel from './MergeModeThumbnailPanel'

// Maps a panel's 0-based page index to its output PDF page number.
// isFirst: true if this panel's pages go first in the interleave (odd output pages).
// countOther: page count of the other panel.
function makePageNumberLabel(isFirst: boolean, countOther: number) {
  const minCount = countOther  // interleaved section length = min(count, countOther), but we only know countOther here
  return (index: number) => {
    const n = index + 1  // 1-based
    if (n <= minCount) {
      return isFirst ? 2 * n - 1 : 2 * n
    }
    // extra pages appended after interleave
    return 2 * minCount + (n - minCount)
  }
}

function itemHeight(panelWidth: number) {
  const thumbWidth = panelWidth - ITEM_PADDING * 2
  const thumbHeight = Math.round(thumbWidth * PAGE_ASPECT)
  return thumbHeight + LABEL_HEIGHT + ITEM_PADDING + ITEM_GAP
}

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

type FirstPageIn = 'a' | 'b'

export default function MergeMode() {
  const [pathA, setPathA] = useState<string | null>(null)
  const [countA, setCountA] = useState(0)
  const [pathB, setPathB] = useState<string | null>(null)
  const [countB, setCountB] = useState(0)
  const [pageA, setPageA] = useState(1)
  const [pageB, setPageB] = useState(1)
  const [firstPageIn, setFirstPageIn] = useState<FirstPageIn>('a')
  const [sharedWidth, setSharedWidth] = useState(DEFAULT_WIDTH)
  const [merging, setMerging] = useState(false)
  const refA = useRef<ThumbnailPanelHandle>(null)
  const refB = useRef<ThumbnailPanelHandle>(null)
  const syncing = useRef(false)

  const handleScrollA = (top: number) => {
    if (syncing.current) return
    syncing.current = true
    refB.current?.scrollTo(top)
    syncing.current = false
  }

  const handleScrollB = (top: number) => {
    if (syncing.current) return
    syncing.current = true
    refA.current?.scrollTo(top)
    syncing.current = false
  }

  const handleChooseA = async () => {
    const p = await OpenPDF()
    if (!p) return
    const count = await PageCount(p)
    setPathA(p)
    setCountA(count)
    setPageA(1)
  }

  const handleChooseB = async () => {
    const p = await OpenPDF()
    if (!p) return
    const count = await PageCount(p)
    setPathB(p)
    setCountB(count)
    setPageB(1)
  }

  const handleMerge = async () => {
    if (!pathA || !pathB) return
    const outPath = await SavePDF()
    if (!outPath) return
    setMerging(true)
    try {
      const effectiveFirst = firstPageIn === 'a' ? pathA : pathB
      const effectiveSecond = firstPageIn === 'a' ? pathB : pathA
      await MergePDFs(effectiveFirst, effectiveSecond, outPath, false)
      notifications.show({ message: `Saved to ${outPath}`, color: 'green' })
    } catch (e) {
      notifications.show({ title: 'Merge failed', message: String(e), color: 'red' })
    } finally {
      setMerging(false)
    }
  }

  const bothLoaded = pathA !== null && pathB !== null

  // Offsets only apply once both files are loaded (they describe interleave order).
  const topPaddingA = bothLoaded && firstPageIn === 'b' ? HALF_THUMB_HEIGHT : 0
  const topPaddingB = bothLoaded && firstPageIn === 'a' ? HALF_THUMB_HEIGHT : 0

  // Equalise the maximum scrollTop of both strips.
  // maxScroll_first  = countFirst  * ihFirst  + 0             - H
  // maxScroll_second = countSecond * ihSecond + HALF_THUMB_HEIGHT - H
  // diff = maxScroll_second - maxScroll_first
  // bottomPadding_first  = max(0,  diff)
  // bottomPadding_second = max(0, -diff)
  const ih = itemHeight(sharedWidth)
  const [countFirst, ihFirst, countSecond, ihSecond] = firstPageIn === 'a'
    ? [countA, ih, countB, ih]
    : [countB, ih, countA, ih]
  const diff = countSecond * ihSecond - countFirst * ihFirst + HALF_THUMB_HEIGHT
  const bottomPaddingFirst  = Math.max(0,  diff)
  const bottomPaddingSecond = Math.max(0, -diff)
  const bottomPaddingA = firstPageIn === 'a' ? bottomPaddingFirst : bottomPaddingSecond
  const bottomPaddingB = firstPageIn === 'a' ? bottomPaddingSecond : bottomPaddingFirst

  const aIsFirst = firstPageIn === 'a'
  const pageLabelA = bothLoaded ? makePageNumberLabel(aIsFirst,  aIsFirst ? countB : countA) : undefined
  const pageLabelB = bothLoaded ? makePageNumberLabel(!aIsFirst, aIsFirst ? countA : countB) : undefined

  // A has no drag handle; B has one — toolbar columns match accordingly
  const colWidthA = sharedWidth
  const colWidthB = sharedWidth + DRAG_HANDLE_WIDTH

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar: columns A and B aligned with their strips, then controls on the right */}
      <Box
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        <FilePickerColumn
          label="File A"
          path={pathA}
          width={colWidthA}
          onChoose={handleChooseA}
        />
        <FilePickerColumn
          label="File B"
          path={pathB}
          width={colWidthB}
          onChoose={handleChooseB}
        />
        <Group gap={12} px={12} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Group gap={8}>
            <Text size="sm" c="dimmed">First page in</Text>
            <SegmentedControl
              size="xs"
              value={firstPageIn}
              onChange={(v) => setFirstPageIn(v as FirstPageIn)}
              data={[
                { label: 'File A', value: 'a' },
                { label: 'File B', value: 'b' },
              ]}
            />
          </Group>
          <Button size="sm" disabled={!bothLoaded} loading={merging} onClick={handleMerge}>
            Merge & Save
          </Button>
        </Group>
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {pathA && (
          <ThumbnailPanel
            ref={refA}
            pdfPath={pathA}
            pageCount={countA}
            selectedPage={pageA}
            onSelectPage={setPageA}
            width={sharedWidth}
            hideDragHandle
            onScroll={handleScrollA}
            hideScrollbar
            topPadding={topPaddingA}
            bottomPadding={bottomPaddingA}
            pageNumberLabel={pageLabelA}
          />
        )}
        {pathB && (
          <ThumbnailPanel
            ref={refB}
            pdfPath={pathB}
            pageCount={countB}
            selectedPage={pageB}
            onSelectPage={setPageB}
            width={sharedWidth}
            onWidthChange={setSharedWidth}
            onScroll={handleScrollB}
            topPadding={topPaddingB}
            bottomPadding={bottomPaddingB}
            pageNumberLabel={pageLabelB}
          />
        )}
        {!pathA && !pathB && (
          <Center style={{ flex: 1 }}>
            <Text c="dimmed" size="sm">Choose PDF files above to begin</Text>
          </Center>
        )}

        {/* Separator between old and new panel */}
        <div style={{ width: 3, height: '100%', flexShrink: 0, background: 'var(--mantine-color-red-5)' }} />

        <MergeModeThumbnailPanel
          pathA={pathA}
          countA={countA}
          pathB={pathB}
          countB={countB}
          selectedPageA={pageA}
          selectedPageB={pageB}
          onSelectPageA={setPageA}
          onSelectPageB={setPageB}
          firstPageIn={firstPageIn}
          onChooseA={handleChooseA}
          onChooseB={handleChooseB}
        />
      </Box>
    </Box>
  )
}


function FilePickerColumn({
  label,
  path,
  width,
  onChoose,
}: {
  label: string
  path: string | null
  width: number
  onChoose: () => void
}) {
  return (
    <Box
      style={{
        width,
        flexShrink: 0,
        padding: '6px 8px',
        borderRight: '1px solid var(--mantine-color-gray-3)',
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
