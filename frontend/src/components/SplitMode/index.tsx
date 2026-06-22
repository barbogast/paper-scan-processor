import { useState, useEffect, useCallback } from 'react'
import { Box, Button, Group, Modal, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import ThumbnailPanel from './ThumbnailPanel'
import DetailPanel from '../DetailPanel'
import { OpenFile, OpenPDF, PageCount, PickFolder, ExportSplit } from '../../../wailsjs/go/main/App'
import { basename } from '../../utils'
import { useOutputFiles } from './useOutputFiles'

const DEFAULT_TEMPLATE = '{date} {name}'

function applyTemplate(template: string): { value: string; cursorPos: number } {
  const date = new Date().toISOString().split('T')[0]
  const withDate = template.replace('{date}', date)
  const nameIdx = withDate.indexOf('{name}')
  if (nameIdx === -1) return { value: withDate, cursorPos: withDate.length }
  return { value: withDate.replace('{name}', ''), cursorPos: nameIdx }
}

// Tracks which filename input should steal focus after a split point is added,
// and where the cursor should land within it. Cleared by the input itself once
// it has focused, so only the first render after the split point is added fires.
function usePendingFocus() {
  const [pendingFocus, setPendingFocus] = useState<{ afterPage: number; cursorPos: number } | null>(null)
  const request = useCallback((afterPage: number, cursorPos: number) => setPendingFocus({ afterPage, cursorPos }), [])
  const clear = useCallback(() => setPendingFocus(null), [])
  return { pendingFocus, request, clear }
}

interface Props {
  initialPath?: string | null
}

export default function SplitMode({ initialPath }: Props) {
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selectedPage, setSelectedPage] = useState(1)
  const [outputFolder, setOutputFolder] = useState<string | null>(null)
  const [successModal, setSuccessModal] = useState<{show: boolean, path: string}>({show: false, path: ''})
  const outputFiles = useOutputFiles()
  const focus = usePendingFocus()
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [exporting, setExporting] = useState(false)

  const resetForFile = (count: number, path: string, tmpl: string) => {
    setPdfPath(path)
    setPageCount(count)
    setSelectedPage(1)
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
      const files = [...outputFiles.all.entries()]
        .sort(([a], [b]) => a - b)
        .map(([firstPage, file]) => ({
          firstPage,
          name: file.name,
          outDir: file.folderOverride ?? outputFolder,
        }))
      await ExportSplit(pdfPath, files)
      setSuccessModal({show: true, path: outputFolder})
    } catch (e) {
      notifications.show({ title: 'Export failed', message: String(e), color: 'red' })
    } finally {
      setExporting(false)
    }
  }

  const handleToggleSplitPoint = useCallback((afterPage: number) => {
    const prefill = applyTemplate(template)
    const added = outputFiles.toggle(afterPage, prefill.value)
    if (added) focus.request(afterPage, prefill.cursorPos)
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
            {outputFolder ? basename(outputFolder) : 'Output folder…'}
          </Button>
          <Button size="xs" disabled={!pdfPath || !outputFolder} loading={exporting} onClick={handleExport}>
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
              selectedPage={selectedPage}
              onSelectPage={setSelectedPage}
              onToggleSplitPoint={handleToggleSplitPoint}
              outputFiles={outputFiles}
              outputFolder={outputFolder}
              focus={focus}
            />
            <DetailPanel
              pdfPath={pdfPath}
              pageNum={selectedPage}
              pageCount={pageCount}
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
