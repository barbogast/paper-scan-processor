import { useState } from 'react'
import { Box, Button, Center, Text } from '@mantine/core'
import ThumbnailPanel from './ThumbnailPanel'
import { OpenPDF, PageCount } from '../../wailsjs/go/main/App'

export default function SplitMode() {
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selectedPage, setSelectedPage] = useState(1)

  const handleOpen = async () => {
    const path = await OpenPDF()
    if (!path) return
    const count = await PageCount(path)
    setPdfPath(path)
    setPageCount(count)
    setSelectedPage(1)
  }

  return (
    <Box style={{ display: 'flex', height: '100%' }}>
      {pdfPath ? (
        <ThumbnailPanel
          pdfPath={pdfPath}
          pageCount={pageCount}
          selectedPage={selectedPage}
          onSelectPage={setSelectedPage}
        />
      ) : null}

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {pdfPath ? (
          <Center style={{ height: '100%' }}>
            <Text c="dimmed" size="sm">Page {selectedPage} of {pageCount}</Text>
          </Center>
        ) : (
          <Center style={{ height: '100%' }}>
            <Button onClick={handleOpen}>Open PDF</Button>
          </Center>
        )}
      </Box>
    </Box>
  )
}
