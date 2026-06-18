import { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Button, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import ThumbnailPanel from './ThumbnailPanel'
import DetailPanel from '../DetailPanel'
import { OpenPDF, PageCount, PickFolder, ExportSplit } from '../../../wailsjs/go/main/App'

interface Props {
  initialPath?: string | null
}

export default function SplitMode({ initialPath }: Props) {
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selectedPage, setSelectedPage] = useState(1)
  const [splitPoints, setSplitPoints] = useState<Set<number>>(new Set())
  const [fileNames, setFileNames] = useState<Map<number, string>>(new Map([[1, '']]))
  const [exporting, setExporting] = useState(false)

  const splitPointsRef = useRef(splitPoints)
  splitPointsRef.current = splitPoints

  const resetForFile = (count: number, path: string) => {
    setPdfPath(path)
    setPageCount(count)
    setSelectedPage(1)
    setSplitPoints(new Set())
    setFileNames(new Map([[1, '']]))
  }

  useEffect(() => {
    if (!initialPath) return
    PageCount(initialPath)
      .then(count => resetForFile(count, initialPath))
      .catch(e => notifications.show({ title: 'Failed to open file', message: String(e), color: 'red' }))
  }, [initialPath])

  const handleOpen = async () => {
    const path = await OpenPDF()
    if (!path) return
    try {
      const count = await PageCount(path)
      resetForFile(count, path)
    } catch (e) {
      notifications.show({ title: 'Failed to open file', message: String(e), color: 'red' })
    }
  }

  const handleExport = async () => {
    if (!pdfPath) return
    const outDir = await PickFolder()
    if (!outDir) return
    setExporting(true)
    try {
      const sorted = [...splitPoints].sort((a, b) => a - b)
      const firstPages = [1, ...sorted.map(p => p + 1)]
      const outNames = firstPages.map(fp => fileNames.get(fp) ?? '')
      await ExportSplit(pdfPath, sorted, outDir, outNames)
      const fileCount = splitPoints.size + 1
      notifications.show({
        title: 'Export complete',
        message: `${fileCount} file${fileCount !== 1 ? 's' : ''} saved to ${outDir}`,
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
    setSplitPoints(prev => {
      const next = new Set(prev)
      if (next.has(afterPage)) { next.delete(afterPage) } else { next.add(afterPage) }
      return next
    })
    setFileNames(prev => {
      const next = new Map(prev)
      if (isAdding) { next.set(afterPage + 1, '') } else { next.delete(afterPage + 1) }
      return next
    })
  }, [])

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
        <Group gap={8} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button size="xs" variant="default" onClick={handleOpen}>
            Open PDF
          </Button>
          <Button size="xs" disabled={!pdfPath} loading={exporting} onClick={handleExport}>
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
