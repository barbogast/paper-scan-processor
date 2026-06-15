import { useState } from 'react'
import { Box, Button, Center, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { MergePDFs, OpenPDF, SavePDF } from '../../wailsjs/go/main/App'

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

export default function MergeMode() {
  const [frontPath, setFrontPath] = useState<string | null>(null)
  const [backPath, setBackPath] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)

  const handleChooseFront = async () => {
    const p = await OpenPDF()
    if (p) setFrontPath(p)
  }

  const handleChooseBack = async () => {
    const p = await OpenPDF()
    if (p) setBackPath(p)
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

  return (
    <Center style={{ height: '100%' }}>
      <Stack gap="md" style={{ minWidth: 420 }}>
        <FilePicker label="Front PDF" path={frontPath} onChoose={handleChooseFront} />
        <FilePicker label="Back PDF" path={backPath} onChoose={handleChooseBack} />
        <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            onClick={handleMerge}
            disabled={!frontPath || !backPath}
            loading={merging}
          >
            Merge & Save
          </Button>
        </Box>
      </Stack>
    </Center>
  )
}

function FilePicker({
  label,
  path,
  onChoose,
}: {
  label: string
  path: string | null
  onChoose: () => void
}) {
  return (
    <Group gap="sm">
      <Text size="sm" style={{ width: 72, flexShrink: 0 }}>{label}</Text>
      <Text size="sm" c={path ? undefined : 'dimmed'} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {path ? basename(path) : 'not selected'}
      </Text>
      <Button size="xs" variant="default" onClick={onChoose} style={{ flexShrink: 0 }}>
        Choose…
      </Button>
    </Group>
  )
}
