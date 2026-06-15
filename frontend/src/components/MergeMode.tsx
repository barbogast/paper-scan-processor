import { useState } from 'react'
import { Box, Button, Center, Divider, Group, SegmentedControl, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MergePDFs, OpenPDF, PageCount, SavePDF } from '../../wailsjs/go/main/App'
import ThumbnailPanel, { HALF_THUMB_HEIGHT } from './ThumbnailPanel'

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

type FirstPageIn = 'a' | 'b'

export default function MergeMode() {
  const [pathA, setPathA] = useState<string | null>(null)
  const [countA, setCountA] = useState(0)
  const [pathB, setPathB] = useState<string | null>(null)
  const [countB, setCountB] = useState(0)
  const [pageA, setPageA] = useState(1)
  const [pageB, setPageB] = useState(1)
  const [firstPageIn, setFirstPageIn] = useState<FirstPageIn>('a')
  const [merging, setMerging] = useState(false)

  const handleChooseA = async () => {
    const p = await OpenPDF()
    if (!p) return
    const count = await PageCount(p)
    setPathA(p)
    setCountA(count)
    setPageA(1)
  }

  const handleChooseB = async () => {
    const p = await OpenPDF()
    if (!p) return
    const count = await PageCount(p)
    setPathB(p)
    setCountB(count)
    setPageB(1)
  }

  const handleMerge = async () => {
    if (!pathA || !pathB) return
    const outPath = await SavePDF()
    if (!outPath) return
    setMerging(true)
    try {
      const effectiveFirst = firstPageIn === 'a' ? pathA : pathB
      const effectiveSecond = firstPageIn === 'a' ? pathB : pathA
      await MergePDFs(effectiveFirst, effectiveSecond, outPath, false)
      notifications.show({ message: `Saved to ${outPath}`, color: 'green' })
    } catch (e) {
      notifications.show({ title: 'Merge failed', message: String(e), color: 'red' })
    } finally {
      setMerging(false)
    }
  }

  const bothLoaded = pathA !== null && pathB !== null

  // Strip labels reflect which file goes first in the interleave
  const labelA = firstPageIn === 'a' ? 'A' : 'B'
  const labelB = firstPageIn === 'a' ? 'B' : 'A'
  const offsetA = firstPageIn === 'b' ? HALF_THUMB_HEIGHT : 0
  const offsetB = firstPageIn === 'a' ? HALF_THUMB_HEIGHT : 0

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
        <FilePickerInline label="File A" path={pathA} onChoose={handleChooseA} />
        <Divider orientation="vertical" />
        <FilePickerInline label="File B" path={pathB} onChoose={handleChooseB} />
        <Divider orientation="vertical" />
        <Group gap={8}>
          <Text size="sm" c="dimmed">First page in</Text>
          <SegmentedControl
            size="xs"
            value={firstPageIn}
            onChange={(v) => setFirstPageIn(v as FirstPageIn)}
            data={[
              { label: 'File A', value: 'a' },
              { label: 'File B', value: 'b' },
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
            <StripColumn offset={offsetA}>
              <ThumbnailPanel
                pdfPath={pathA}
                pageCount={countA}
                selectedPage={pageA}
                onSelectPage={setPageA}
                label={labelA}
              />
            </StripColumn>
            <StripColumn offset={offsetB}>
              <ThumbnailPanel
                pdfPath={pathB}
                pageCount={countB}
                selectedPage={pageB}
                onSelectPage={setPageB}
                label={labelB}
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
