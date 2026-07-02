import { useState, useEffect, useCallback } from 'react'
import { Box, Button, Divider, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import ThumbnailPanel from './ThumbnailPanel'
import DetailPanel from '../DetailPanel'
import { OpenFile, OpenPDF, PageCount, PickFolder, ExportSplit, CheckConflicts, DeleteFile } from '../../../wailsjs/go/main/App'
import { ellipsisPath } from '../../utils'
import { useOutputFiles } from './useOutputFiles'
import { usePendingFocus } from './usePendingFocus'
import * as pageCache from '../../lib/pageCache'

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
  const [successModal, setSuccessModal] = useState<{show: boolean, outputPath: string, inputPath: string}>({show: false, outputPath: '', inputPath: ''})
  const outputFiles = useOutputFiles(outputFolder)
  const focus = usePendingFocus()
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [exporting, setExporting] = useState(false)
  const [rotations, setRotations] = useState<Map<number, number>>(() => new Map())
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    return () => {
      if (pdfPath) pageCache.evict(pdfPath)
    }
  }, [pdfPath])

  const rotate = (page: number, delta: 90 | -90 = 90) => {
    setRotations(prev => {
      const next = new Map(prev)
      const deg = ((next.get(page) ?? 0) + delta + 360) % 360
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

  const movePage = (fromPos: number, toPos: number) => {
    setPageOrder(prev => {
      const next = [...prev]
      const [page] = next.splice(fromPos, 1)
      next.splice(toPos, 0, page)
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
      const sortedStarts = [...outputFiles.all.keys()].sort((a, b) => a - b)
      const files = sortedStarts.map((firstPos, i) => {
        const nextPos = sortedStarts[i + 1] ?? pageOrder.length
        const pages = pageOrder.slice(firstPos, nextPos).filter(p => !skipped.has(p))
        const f = outputFiles.all.get(firstPos)!
        return { pages, name: f.name, outDir: f.folderOverride ?? outputFolder! }
      })
      const conflicts = await CheckConflicts(files)
      if (conflicts.length > 0) {
        const names = conflicts.map(p => p.split('/').pop()).join(', ')
        notifications.show({ title: 'Filename conflict', message: `Already exists: ${names}`, color: 'orange', autoClose: false })
        return
      }
      await ExportSplit(pdfPath, files, Object.fromEntries(rotations))
      setSuccessModal({show: true, outputPath: outputFolder, inputPath: pdfPath})
    } catch (e) {
      notifications.show({ title: 'Export failed', message: String(e), color: 'red' })
    } finally {
      setExporting(false)
    }
  }

  const closeSuccessModal = () => setSuccessModal({show: false, outputPath: '', inputPath: ''})

  const handleDeleteInput = async () => {
    const { inputPath } = successModal
    closeSuccessModal()
    setPdfPath(null)
    try {
      await DeleteFile(inputPath)
    } catch (e) {
      notifications.show({ title: 'Failed to delete file', message: String(e), color: 'red' })
    }
  }

  const handleToggleSplitPoint = useCallback((afterPosition: number) => {
    const prefill = applyTemplate(template)
    const added = outputFiles.toggle(afterPosition, prefill.value)
    if (added) focus.request(afterPosition, prefill.cursorPos)
    else focus.clear()
  }, [template, outputFiles.toggle])

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Modal opened={successModal.show} onClose={closeSuccessModal} title="Export complete" centered>
        <Stack gap="md">
          <Group>
            <Text size="sm" c="dimmed" style={{ flex: 1 }}>{successModal.outputPath}</Text>
            <Button size="xs" variant="default" onClick={() => OpenFile(successModal.outputPath)}>
              Open in Finder
            </Button>
          </Group>
          <Divider />
          <div>
            <Text size="sm" mb={4}>What do you want to do with the input file?</Text>
            <Text size="sm" c="dimmed" mb="sm">{successModal.inputPath.split('/').pop()}</Text>
            <Group>
              <Button variant="default" onClick={closeSuccessModal}>Keep</Button>
              <Button color="red" onClick={handleDeleteInput}>Delete</Button>
            </Group>
          </div>
        </Stack>
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
          <Button size="xs" disabled={!pdfPath || !outputFolder || outputFiles.duplicateFirstPages.size > 0} loading={exporting} onClick={handleExport}>
            Export
          </Button>
        </Group>
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {pdfPath ? (
          <>
            <ThumbnailPanel
              pdfPath={pdfPath}
              pageOrder={pageOrder}
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
              onMovePage={movePage}
            />
            <DetailPanel
              pdfPath={pdfPath}
              pageNum={selectedPage}
              pageCount={pageCount}
              rotation={rotations.get(selectedPage) ?? 0}
              onRotate={(delta) => rotate(selectedPage, delta)}
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
