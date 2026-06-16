import { useState } from 'react'
import { Box, Button, Checkbox, Group, SegmentedControl, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MergePDFs, OpenPDF, PageCount, SavePDF } from '../../../wailsjs/go/main/App'
import MergeModeThumbnailPanel, { DEFAULT_TOTAL_WIDTH, FirstPageIn, SelectedPage } from './ThumbnailPanel'
import DetailPanel from '../DetailPanel'

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

export default function MergeMode() {
  const [pathA, setPathA] = useState<string | null>(null)
  const [countA, setCountA] = useState(0)
  const [pathB, setPathB] = useState<string | null>(null)
  const [countB, setCountB] = useState(0)
  const [selectedPage, setSelectedPage] = useState<SelectedPage>({ file: 'a', page: 1 })
  const [firstPageIn, setFirstPageIn] = useState<FirstPageIn>('a')
  const [reverseB, setReverseB] = useState(true)
  const [merging, setMerging] = useState(false)
  const [totalWidth, setTotalWidth] = useState(DEFAULT_TOTAL_WIDTH)

  // Subtract 22px to account for scrollbar + gap
  const colWidth = Math.floor((totalWidth - 22) / 2)

  const handleChoose = async (file: FirstPageIn) => {
    const p = await OpenPDF()
    if (!p) return
    const count = await PageCount(p)
    if (file === 'a') { setPathA(p); setCountA(count) }
    else { setPathB(p); setCountB(count) }
    setSelectedPage({ file, page: 1 })
  }

  const handleMerge = async () => {
    if (!pathA || !pathB) return
    const outPath = await SavePDF()
    if (!outPath) return
    setMerging(true)
    try {
      const effectiveFirst = firstPageIn === 'a' ? pathA : pathB
      const effectiveSecond = firstPageIn === 'a' ? pathB : pathA
      await MergePDFs(effectiveFirst, effectiveSecond, outPath, reverseB)
      notifications.show({ message: `Saved to ${outPath}`, color: 'green' })
    } catch (e) {
      notifications.show({ title: 'Merge failed', message: String(e), color: 'red' })
    } finally {
      setMerging(false)
    }
  }

  const bothLoaded = pathA !== null && pathB !== null
  const selectedPath = selectedPage.file === 'a' ? pathA : pathB
  const selectedCount = selectedPage.file === 'a' ? countA : countB

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        <FilePickerColumn label="File A" path={pathA} width={colWidth} onChoose={() => handleChoose('a')} />
        {/* Add 26 px to account for scrollbar + gap */}
        <FilePickerColumn label="File B" path={pathB} width={colWidth + 26} onChoose={() => handleChoose('b')} />
        <Group gap={8} px={12} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Checkbox
            size="sm"
            label="Reverse File B"
            checked={reverseB}
            onChange={(e) => setReverseB(e.currentTarget.checked)}
          />
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
          <Button size="sm" disabled={!bothLoaded} loading={merging} onClick={handleMerge}>
            Merge & Save
          </Button>
        </Group>
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <MergeModeThumbnailPanel
          pathA={pathA}
          countA={countA}
          pathB={pathB}
          countB={countB}
          selectedPage={selectedPage}
          onSelectPage={(file, page) => setSelectedPage({ file, page })}
          firstPageIn={firstPageIn}
          totalWidth={totalWidth}
          onWidthChange={setTotalWidth}
          colWidth={colWidth}
          reverseB={reverseB}
        />
        {selectedPath && (
          <DetailPanel
            pdfPath={selectedPath}
            pageNum={selectedPage.page}
            pageCount={selectedCount}
            onNavigate={(page) => setSelectedPage({ file: selectedPage.file, page })}
          />
        )}
      </Box>
    </Box>
  )
}

function FilePickerColumn({
  label, path, width, onChoose,
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
