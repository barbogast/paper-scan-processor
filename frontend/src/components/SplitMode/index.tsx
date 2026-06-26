import { useState, useEffect, useCallback } from 'react'
import { Box, Button, Group, Modal, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import ThumbnailPanel from './ThumbnailPanel'
import DetailPanel from '../DetailPanel'
import { OpenFile, OpenPDF, PageCount, PickFolder, ExportSplit } from '../../../wailsjs/go/main/App'
import { basename, ellipsisPath } from '../../utils'
import { useOutputFiles } from './useOutputFiles'
import { usePendingFocus } from './usePendingFocus'

const DEFAULT_TEMPLATE = '{date} {name}'

function applyTemplate(template: string): { value: string; cursorPos: number } {
  const date = new Date().toISOString().split('T')[0]
  const withDate = template.replace('{date}', date)
  const nameIdx = withDate.indexOf('{name}')
  if (nameIdx === -1) return { value: withDate, cursorPos: withDate.length }
  return { value: withDate.replace('{name}', ''), cursorPos: nameIdx }
}

interface Props {
  initialPath?: string | null
}

export default function SplitMode({ initialPath }: Props) {
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageOrder, setPageOrder] = useState<number[]>([])
  const [selectedPage, setSelectedPage] = useState(1)
  const [outputFolder, setOutputFolder] = useState<string | null>(null)
  const [successModal, setSuccessModal] = useState<{show: boolean, path: string}>({show: false, path: ''})
  const outputFiles = useOutputFiles(outputFolder)
  const focus = usePendingFocus()
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [exporting, setExporting] = useState(false)
  const [rotations, setRotations] = useState<Map<number, number>>(() => new Map())
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set())

  const rotate = (page: number) => {
    setRotations(prev => {
      const next = new Map(prev)
      const deg = ((next.get(page) ?? 0) + 90) % 360
      if (deg === 0) next.delete(page); else next.set(page, deg)
      return next
    })
  }

  const toggleSkip = (page: number) => {
    setSkipped(prev => {
      const next = new Set(prev)
      if (next.has(page)) next.delete(page); else next.add(page)
      return next
    })
  }

  const resetForFile = (count: number, path: string, tmpl: string) => {
    setPdfPath(path)
    setPageCount(count)
    setPageOrder(Array.from({ length: count }, (_, i) => i + 1))
    setSelectedPage(1)
    setRotations(new Map())
    setSkipped(new Set())
    outputFiles.reset(applyTemplate(tmpl).value)
    focus.clear()
  }

  useEffect(() => {
    if (!initialPath) return
    PageCount(initialPath)
      .then(count => resetForFile(count, initialPath, template))
      .catch(e => notifications.show({ title: 'Failed to open file', message: String(e), color: 'red' }))
  }, [initialPath])

  const handleOpen = async () => {
    const path = await OpenPDF()
    if (!path) return
    try {
      const count = await PageCount(path)
      resetForFile(count, path, template)
    } catch (e) {
      notifications.show({ title: 'Failed to open file', message: String(e), color: 'red' })
    }
  }

  const handlePickOutputFolder = async () => {
    const folder = await PickFolder()
    if (folder) setOutputFolder(folder)
  }

  const handleExport = async () => {
    if (!pdfPath || !outputFolder) return
    setExporting(true)
    try {
      // Build ordered page list per segment from pageOrder and splitPoints.
      const segments: number[][] = []
      let current: number[] = []
      for (let i = 0; i < pageOrder.length; i++) {
        if (i > 0 && outputFiles.splitPoints.has(i - 1)) {
          segments.push(current)
          current = []
        }
        const page = pageOrder[i]
        if (!skipped.has(page)) current.push(page)
      }
      segments.push(current)

      const files = outputFiles.files.map((file, i) => ({
        pages: segments[i] ?? [],
        name: file.name,
        outDir: file.folderOverride ?? outputFolder,
      }))
      await ExportSplit(pdfPath, files, Object.fromEntries(rotations))
      setSuccessModal({show: true, path: outputFolder})
    } catch (e) {
      notifications.show({ title: 'Export failed', message: String(e), color: 'red' })
    } finally {
      setExporting(false)
    }
  }

  const handleToggleSplitPoint = useCallback((afterDisplayIndex: number) => {
    const prefill = applyTemplate(template)
    const { added, segmentIndex } = outputFiles.toggle(afterDisplayIndex, prefill.value)
    if (added) focus.request(segmentIndex, prefill.cursorPos)
    else focus.clear()
  }, [template, outputFiles.toggle])

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Modal opened={successModal.show} onClose={() => setSuccessModal({show: false, path: ''})} title="Export complete" centered>
        <Text size="sm" c="dimmed" mb="md">{successModal.path}</Text>
        <Button variant="default" onClick={() => OpenFile(successModal.path!)}>
          Open in Finder
        </Button>
      </Modal>
      <Box
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          display: 'flex',
          alignItems: 'center',
          paddingInline: 12,
          height: 44,
        }}
      >
        <Group gap={8} style={{ width: '100%' }}>
          <Button size="xs" variant="default" onClick={handleOpen}>
            Open PDF
          </Button>
          <TextInput
            size="xs"
            placeholder={DEFAULT_TEMPLATE}
            value={template}
            onChange={(e) => setTemplate(e.currentTarget.value)}
            leftSection={<span style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--mantine-color-dimmed)' }}>Template</span>}
            leftSectionWidth={60}
            style={{ flex: 1 }}
          />
          <Button size="xs" variant="default" onClick={handlePickOutputFolder}>
            {outputFolder ? ellipsisPath(outputFolder) : 'Output folder…'}
          </Button>
          <Button size="xs" disabled={!pdfPath || !outputFolder || outputFiles.duplicates.size > 0} loading={exporting} onClick={handleExport}>
            Export
          </Button>
        </Group>
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {pdfPath ? (
          <>
            <ThumbnailPanel
              pdfPath={pdfPath}
              pageCount={pageCount}
              pageOrder={pageOrder}
              onReorder={setPageOrder}
              selectedPage={selectedPage}
              onSelectPage={setSelectedPage}
              onToggleSplitPoint={handleToggleSplitPoint}
              outputFiles={outputFiles}
              outputFolder={outputFolder}
              focus={focus}
              rotations={rotations}
              onRotate={rotate}
              skipped={skipped}
              onToggleSkip={toggleSkip}
            />
            <DetailPanel
              pdfPath={pdfPath}
              pageNum={selectedPage}
              pageCount={pageCount}
              rotation={rotations.get(selectedPage) ?? 0}
              onRotate={() => rotate(selectedPage)}
              onNavigate={setSelectedPage}
            />
          </>
        ) : (
          <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Button onClick={handleOpen}>Open PDF</Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}
