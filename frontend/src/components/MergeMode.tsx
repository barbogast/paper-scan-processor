import { useState } from 'react'
import { Box, Button, Center, Divider, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MergePDFs, OpenPDF, PageCount, SavePDF } from '../../wailsjs/go/main/App'
import ThumbnailPanel from './ThumbnailPanel'

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

export default function MergeMode() {
  const [frontPath, setFrontPath] = useState<string | null>(null)
  const [frontCount, setFrontCount] = useState(0)
  const [backPath, setBackPath] = useState<string | null>(null)
  const [backCount, setBackCount] = useState(0)
  const [frontPage, setFrontPage] = useState(1)
  const [backPage, setBackPage] = useState(1)
  const [merging, setMerging] = useState(false)

  const handleChooseFront = async () => {
    const p = await OpenPDF()
    if (!p) return
    const count = await PageCount(p)
    setFrontPath(p)
    setFrontCount(count)
    setFrontPage(1)
  }

  const handleChooseBack = async () => {
    const p = await OpenPDF()
    if (!p) return
    const count = await PageCount(p)
    setBackPath(p)
    setBackCount(count)
    setBackPage(1)
  }

  const handleMerge = async () => {
    if (!frontPath || !backPath) return
    const outPath = await SavePDF()
    if (!outPath) return
    setMerging(true)
    try {
      await MergePDFs(frontPath, backPath, outPath, false)
      notifications.show({ message: `Saved to ${outPath}`, color: 'green' })
    } catch (e) {
      notifications.show({ title: 'Merge failed', message: String(e), color: 'red' })
    } finally {
      setMerging(false)
    }
  }

  const bothLoaded = frontPath !== null && backPath !== null

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <FilePickerInline label="Front PDF" path={frontPath} onChoose={handleChooseFront} />
        <Divider orientation="vertical" />
        <FilePickerInline label="Back PDF" path={backPath} onChoose={handleChooseBack} />
        <Box style={{ flex: 1 }} />
        <Button size="sm" disabled={!bothLoaded} loading={merging} onClick={handleMerge}>
          Merge & Save
        </Button>
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {bothLoaded ? (
          <>
            <ThumbnailPanel
              pdfPath={frontPath}
              pageCount={frontCount}
              selectedPage={frontPage}
              onSelectPage={setFrontPage}
            />
            <ThumbnailPanel
              pdfPath={backPath}
              pageCount={backCount}
              selectedPage={backPage}
              onSelectPage={setBackPage}
            />
          </>
        ) : (
          <Center style={{ flex: 1 }}>
            <Text c="dimmed" size="sm">Choose both PDF files above to begin</Text>
          </Center>
        )}
      </Box>
    </Box>
  )
}

function FilePickerInline({
  label,
  path,
  onChoose,
}: {
  label: string
  path: string | null
  onChoose: () => void
}) {
  return (
    <Group gap={8}>
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {path ? basename(path) : '—'}
      </Text>
      <Button size="xs" variant="default" onClick={onChoose}>
        Choose…
      </Button>
    </Group>
  )
}
