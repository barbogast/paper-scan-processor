import { useState } from 'react'
import { Box, Button } from '@mantine/core'
import ThumbnailPanel from './ThumbnailPanel'
import DetailPanel, { DETAIL_WIDTH } from '../DetailPanel'
import { usePageLoader } from '../../hooks/usePageLoader'
import { OpenPDF, PageCount } from '../../../wailsjs/go/main/App'

export default function SplitMode() {
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selectedPage, setSelectedPage] = useState(1)
  const detailLoader = usePageLoader(pdfPath ?? '', DETAIL_WIDTH)

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
            loader={detailLoader}
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
