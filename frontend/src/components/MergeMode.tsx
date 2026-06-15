import { useState } from 'react'
import { Box, Button, Center, Divider, Group, SegmentedControl, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MergePDFs, OpenPDF, PageCount, SavePDF } from '../../wailsjs/go/main/App'
import ThumbnailPanel, { HALF_THUMB_HEIGHT } from './ThumbnailPanel'

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

type FirstPageIn = 'front' | 'back'

export default function MergeMode() {
  const [frontPath, setFrontPath] = useState<string | null>(null)
  const [frontCount, setFrontCount] = useState(0)
  const [backPath, setBackPath] = useState<string | null>(null)
  const [backCount, setBackCount] = useState(0)
  const [frontPage, setFrontPage] = useState(1)
  const [backPage, setBackPage] = useState(1)
  const [firstPageIn, setFirstPageIn] = useState<FirstPageIn>('front')
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
      const effectiveFront = firstPageIn === 'front' ? frontPath : backPath
      const effectiveBack = firstPageIn === 'front' ? backPath : frontPath
      await MergePDFs(effectiveFront, effectiveBack, outPath, false)
      notifications.show({ message: `Saved to ${outPath}`, color: 'green' })
    } catch (e) {
      notifications.show({ title: 'Merge failed', message: String(e), color: 'red' })
    } finally {
      setMerging(false)
    }
  }

  const bothLoaded = frontPath !== null && backPath !== null

  // Which strip contains the first output page (labeled "Fronts"), and which is offset
  const frontLabel = firstPageIn === 'front' ? 'Fronts' : 'Backs'
  const backLabel = firstPageIn === 'front' ? 'Backs' : 'Fronts'
  const frontOffset = firstPageIn === 'back' ? HALF_THUMB_HEIGHT : 0
  const backOffset = firstPageIn === 'front' ? HALF_THUMB_HEIGHT : 0

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
        <Divider orientation="vertical" />
        <Group gap={8}>
          <Text size="sm" c="dimmed">First page in</Text>
          <SegmentedControl
            size="xs"
            value={firstPageIn}
            onChange={(v) => setFirstPageIn(v as FirstPageIn)}
            data={[
              { label: 'Front file', value: 'front' },
              { label: 'Back file', value: 'back' },
            ]}
          />
        </Group>
        <Box style={{ flex: 1 }} />
        <Button size="sm" disabled={!bothLoaded} loading={merging} onClick={handleMerge}>
          Merge & Save
        </Button>
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {bothLoaded ? (
          <>
            <StripColumn offset={frontOffset}>
              <ThumbnailPanel
                pdfPath={frontPath}
                pageCount={frontCount}
                selectedPage={frontPage}
                onSelectPage={setFrontPage}
                label={frontLabel}
              />
            </StripColumn>
            <StripColumn offset={backOffset}>
              <ThumbnailPanel
                pdfPath={backPath}
                pageCount={backCount}
                selectedPage={backPage}
                onSelectPage={setBackPage}
                label={backLabel}
              />
            </StripColumn>
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

function StripColumn({ offset, children }: { offset: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        height: '100%',
        paddingTop: offset,
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
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
