import { useState } from 'react'
import { Box, Button, Group, SegmentedControl, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MergePDFs, OpenPDF, PageCount, SavePDF } from '../../wailsjs/go/main/App'
import MergeModeThumbnailPanel from './MergeModeThumbnailPanel'

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

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          paddingInline: 12,
          height: 48,
        }}
      >
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
        <Button size="sm" disabled={!bothLoaded} loading={merging} onClick={handleMerge}>
          Merge & Save
        </Button>
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <MergeModeThumbnailPanel
          pathA={pathA}
          countA={countA}
          pathB={pathB}
          countB={countB}
          selectedPageA={pageA}
          selectedPageB={pageB}
          onSelectPageA={setPageA}
          onSelectPageB={setPageB}
          firstPageIn={firstPageIn}
          onChooseA={handleChooseA}
          onChooseB={handleChooseB}
        />
      </Box>
    </Box>
  )
}
