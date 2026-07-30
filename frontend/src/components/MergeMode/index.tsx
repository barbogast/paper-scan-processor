import { useState, useEffect } from 'react'
import { Box, Button, Checkbox, Group, Modal, SegmentedControl, Text, Tooltip } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { MergePDFs, OpenFile, SavePDF } from '../../../wailsjs/go/main/App'
import MergeModeThumbnailPanel, { DEFAULT_TOTAL_WIDTH, FirstPageIn, SelectedPage } from './ThumbnailPanel'
import DetailPanel from '../DetailPanel'
import AsyncButton from '../AsyncButton'
import { usePDFFile } from './usePDFFile'
import * as pageCache from '../../lib/pageCache'
import { basename } from '../../utils'
import { DRAG_HANDLE_WIDTH } from '../../constants'
import styles from './index.module.css'

// Width consumed by the scrollbar inside the two-column thumbnail area.
const SCROLLBAR_WIDTH = 22

interface Props {
  onOpenInSplitMode: (path: string) => void
}

export default function MergeMode({ onOpenInSplitMode }: Props) {
  const fileA = usePDFFile()
  const fileB = usePDFFile()
  const [selectedPage, setSelectedPage] = useState<SelectedPage>({ file: 'a', page: 1 })
  const [firstPageIn, setFirstPageIn] = useState<FirstPageIn>('a')
  const [reverseB, setReverseB] = useState(true)
  const [mergedPath, setMergedPath] = useState<string | null>(null)
  const [totalWidth, setTotalWidth] = useState(DEFAULT_TOTAL_WIDTH)

  useEffect(() => {
    return () => {
      if (fileA.path) pageCache.evict(fileA.path)
      if (fileB.path) pageCache.evict(fileB.path)
    }
  }, [fileA.path, fileB.path])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const selectedFile = selectedPage.file === 'a' ? fileA : fileB
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (selectedPage.page > 1) setSelectedPage(p => ({ ...p, page: p.page - 1 }))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (selectedPage.page < selectedFile.count) setSelectedPage(p => ({ ...p, page: p.page + 1 }))
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        selectedFile.toggleSkip(selectedPage.page)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedPage, fileA, fileB])

  const colWidth = Math.floor((totalWidth - SCROLLBAR_WIDTH) / 2)

  const handleChoose = async (file: FirstPageIn) => {
    const loaded = await (file === 'a' ? fileA : fileB).load()
    if (loaded) setSelectedPage({ file, page: 1 })
  }

  const handleMerge = async () => {
    if (!fileA.path || !fileB.path) return
    const outPath = await SavePDF()
    if (!outPath) return
    await MergePDFs(
      fileA.path, fileB.path, outPath,
      firstPageIn === 'a', reverseB,
      [...fileA.skipped], [...fileB.skipped],
      Object.fromEntries(fileA.rotations), Object.fromEntries(fileB.rotations),
    )
    setMergedPath(outPath)
  }

  const bothLoaded = fileA.path !== null && fileB.path !== null
  const unequalCounts = bothLoaded && fileA.count !== fileB.count
  const selectedFile = selectedPage.file === 'a' ? fileA : fileB
  const selectedPath = selectedFile.path
  const selectedCount = selectedFile.count

  return (
    <Box className={styles.root}>
      <Modal opened={mergedPath !== null} onClose={() => setMergedPath(null)} title="Merge complete" centered>
        <Text size="sm" c="dimmed" mb="md">{mergedPath}</Text>
        <Group>
          <AsyncButton variant="default" errorTitle="Failed to open file" onClick={() => OpenFile(mergedPath!)}>
            Open in Default App
          </AsyncButton>
          <Button onClick={() => { onOpenInSplitMode(mergedPath!); setMergedPath(null) }}>
            Open in Split Mode
          </Button>
        </Group>
      </Modal>
      <Box className={styles.headerRow}>
        <FilePickerColumn label="File A" path={fileA.path} width={colWidth} onChoose={() => handleChoose('a')} />
        <FilePickerColumn label="File B" path={fileB.path} width={colWidth + SCROLLBAR_WIDTH + DRAG_HANDLE_WIDTH} onChoose={() => handleChoose('b')} />
        <Group gap={8} px={12} className={styles.controlsGroup}>
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
          <AsyncButton size="sm" disabled={!bothLoaded} errorTitle="Merge failed" onClick={handleMerge}>
            Merge & Save
          </AsyncButton>
        </Group>
      </Box>

      <Box className={styles.body}>
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
            onToggleSkip={() => selectedFile.toggleSkip(selectedPage.page)}
            onRotate={(delta) => selectedFile.rotate(selectedPage.page, delta)}
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
  onChoose: () => Promise<void>
}) {
  return (
    <Box className={styles.column} style={{ width }}>
      <Group justify="space-between" gap={4} wrap="nowrap">
        <Text size="xs" c="dimmed">{label}</Text>
        <AsyncButton size="xs" variant="default" errorTitle="Failed to open file" onClick={onChoose}>Choose…</AsyncButton>
      </Group>
      <Text size="xs" className={styles.columnPath} title={path ?? undefined}>
        {path ? basename(path) : '—'}
      </Text>
    </Box>
  )
}
