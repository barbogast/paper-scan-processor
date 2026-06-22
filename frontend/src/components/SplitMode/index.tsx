import { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Button, Group, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import ThumbnailPanel from './ThumbnailPanel'
import DetailPanel from '../DetailPanel'
import { OpenPDF, PageCount, PickFolder, ExportSplit } from '../../../wailsjs/go/main/App'
import { basename } from '../../utils'

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
  const [splitPoints, setSplitPoints] = useState<Set<number>>(new Set())
  const [fileNames, setFileNames] = useState<Map<number, string>>(new Map([[1, '']]))
  const [outputFolder, setOutputFolder] = useState<string | null>(null)
  const [folderOverrides, setFolderOverrides] = useState<Map<number, string>>(new Map())
  const focus = usePendingFocus()
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [exporting, setExporting] = useState(false)

  const splitPointsRef = useRef(splitPoints)
  splitPointsRef.current = splitPoints

  const resetForFile = (count: number, path: string, tmpl: string) => {
    setPdfPath(path)
    setPageCount(count)
    setSelectedPage(1)
    setSplitPoints(new Set())
    setFileNames(new Map([[1, applyTemplate(tmpl).value]]))
    setFolderOverrides(new Map())
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

  const handlePickFolderOverride = useCallback(async (firstPage: number) => {
    const folder = await PickFolder()
    if (folder) setFolderOverrides(prev => new Map(prev).set(firstPage, folder))
  }, [])

  const handleExport = async () => {
    if (!pdfPath || !outputFolder) return
    setExporting(true)
    try {
      const sorted = [...splitPoints].sort((a, b) => a - b)
      const firstPages = [1, ...sorted.map(p => p + 1)]
      const outNames = firstPages.map(fp => fileNames.get(fp) ?? '')
      const outDirs = firstPages.map(fp => folderOverrides.get(fp) ?? outputFolder)
      await ExportSplit(pdfPath, sorted, outDirs, outNames)
      const fileCount = splitPoints.size + 1
      notifications.show({
        title: 'Export complete',
        message: `${fileCount} file${fileCount !== 1 ? 's' : ''} saved`,
        color: 'green',
      })
    } catch (e) {
      notifications.show({ title: 'Export failed', message: String(e), color: 'red' })
    } finally {
      setExporting(false)
    }
  }

  const toggleSplitPoint = useCallback((afterPage: number) => {
    const isAdding = !splitPointsRef.current.has(afterPage)
    const prefill = isAdding ? applyTemplate(template) : null
    setSplitPoints(prev => {
      const next = new Set(prev)
      if (next.has(afterPage)) { next.delete(afterPage) } else { next.add(afterPage) }
      return next
    })
    setFileNames(prev => {
      const next = new Map(prev)
      if (prefill) { next.set(afterPage + 1, prefill.value) } else { next.delete(afterPage + 1) }
      return next
    })
    if (!isAdding) {
      setFolderOverrides(prev => {
        const next = new Map(prev)
        next.delete(afterPage + 1)
        return next
      })
    }
    if (prefill) focus.request(afterPage, prefill.cursorPos)
    else focus.clear()
  }, [template])

  const handleFileNameChange = useCallback((firstPage: number, name: string) => {
    setFileNames(prev => new Map(prev).set(firstPage, name))
  }, [])

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              splitPoints={splitPoints}
              onToggleSplitPoint={toggleSplitPoint}
              fileNames={fileNames}
              onFileNameChange={handleFileNameChange}
              outputFolder={outputFolder}
              folderOverrides={folderOverrides}
              onPickFolderOverride={handlePickFolderOverride}
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
