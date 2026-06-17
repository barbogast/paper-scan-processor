import { useState } from 'react'
import { Box, Button, Checkbox, Group, SegmentedControl, Text, Tooltip } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { MergePDFs, SavePDF } from '../../../wailsjs/go/main/App'
import MergeModeThumbnailPanel, { DEFAULT_TOTAL_WIDTH, FirstPageIn, SelectedPage } from './ThumbnailPanel'
import DetailPanel, { DETAIL_WIDTH } from '../DetailPanel'
import { usePDFFile } from '../../hooks/usePDFFile'
import { usePageLoader } from '../../hooks/usePageLoader'

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

export default function MergeMode() {
  const fileA = usePDFFile()
  const fileB = usePDFFile()
  const detailLoaderA = usePageLoader(fileA.path ?? '', DETAIL_WIDTH)
  const detailLoaderB = usePageLoader(fileB.path ?? '', DETAIL_WIDTH)
  const [selectedPage, setSelectedPage] = useState<SelectedPage>({ file: 'a', page: 1 })
  const [firstPageIn, setFirstPageIn] = useState<FirstPageIn>('a')
  const [reverseB, setReverseB] = useState(true)
  const [merging, setMerging] = useState(false)
  const [totalWidth, setTotalWidth] = useState(DEFAULT_TOTAL_WIDTH)

  // Subtract 22px to account for scrollbar + gap
  const colWidth = Math.floor((totalWidth - 22) / 2)

  const handleChoose = async (file: FirstPageIn) => {
    const loaded = await (file === 'a' ? fileA : fileB).load()
    if (loaded) setSelectedPage({ file, page: 1 })
  }

  const handleMerge = async () => {
    if (!fileA.path || !fileB.path) return
    const outPath = await SavePDF()
    if (!outPath) return
    setMerging(true)
    try {
      await MergePDFs(
        fileA.path, fileB.path, outPath,
        firstPageIn === 'a', reverseB,
        [...fileA.skipped], [...fileB.skipped],
        Object.fromEntries(fileA.rotations), Object.fromEntries(fileB.rotations),
      )
      notifications.show({ message: `Saved to ${outPath}`, color: 'green' })
    } catch (e) {
      notifications.show({ title: 'Merge failed', message: String(e), color: 'red' })
    } finally {
      setMerging(false)
    }
  }

  const bothLoaded = fileA.path !== null && fileB.path !== null
  const unequalCounts = bothLoaded && fileA.count !== fileB.count
  const selectedFile = selectedPage.file === 'a' ? fileA : fileB
  const selectedPath = selectedFile.path
  const selectedCount = selectedFile.count

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
        <FilePickerColumn label="File A" path={fileA.path} width={colWidth} onChoose={() => handleChoose('a')} />
        {/* Add 26 px to account for scrollbar + gap */}
        <FilePickerColumn label="File B" path={fileB.path} width={colWidth + 26} onChoose={() => handleChoose('b')} />
        <Group gap={8} px={12} style={{ flex: 1, justifyContent: 'flex-end' }}>
          {unequalCounts && (
            <Tooltip
              label={`File A has ${fileA.count} page${fileA.count !== 1 ? 's' : ''}, File B has ${fileB.count} page${fileB.count !== 1 ? 's' : ''}. The extra ${Math.abs(fileA.count - fileB.count)} page${Math.abs(fileA.count - fileB.count) !== 1 ? 's' : ''} will be appended at the end.`}
              multiline
              w={280}
            >
              <IconAlertTriangle size={18} color="var(--mantine-color-yellow-6)" />
            </Tooltip>
          )}
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
          fileA={fileA}
          fileB={fileB}
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
            rotation={selectedFile.rotations.get(selectedPage.page) ?? 0}
            loader={selectedPage.file === 'a' ? detailLoaderA : detailLoaderB}
            onNavigate={(page) => setSelectedPage({ file: selectedPage.file, page })}
            onToggleSkip={() => selectedFile.toggleSkip(selectedPage.page)}
            onRotate={() => selectedFile.rotate(selectedPage.page)}
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
