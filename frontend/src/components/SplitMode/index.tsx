import { useState, useEffect } from 'react'
import { Box, Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import ThumbnailPanel from './ThumbnailPanel'
import DetailPanel from '../DetailPanel'
import { OpenPDF, PageCount } from '../../../wailsjs/go/main/App'

interface Props {
  initialPath?: string | null
}

export default function SplitMode({ initialPath }: Props) {
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selectedPage, setSelectedPage] = useState(1)

  useEffect(() => {
    if (!initialPath) return
    PageCount(initialPath)
      .then(count => {
        setPdfPath(initialPath)
        setPageCount(count)
        setSelectedPage(1)
      })
      .catch(e => notifications.show({ title: 'Failed to open file', message: String(e), color: 'red' }))
  }, [initialPath])

  const handleOpen = async () => {
    const path = await OpenPDF()
    if (!path) return
    try {
      const count = await PageCount(path)
      setPdfPath(path)
      setPageCount(count)
      setSelectedPage(1)
    } catch (e) {
      notifications.show({ title: 'Failed to open file', message: String(e), color: 'red' })
    }
  }

  return (
    <Box style={{ display: 'flex', height: '100%' }}>
      {pdfPath ? (
        <>
          <ThumbnailPanel
            pdfPath={pdfPath}
            pageCount={pageCount}
            selectedPage={selectedPage}
            onSelectPage={setSelectedPage}
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
  )
}
