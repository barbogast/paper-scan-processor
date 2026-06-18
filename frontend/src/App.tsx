import { useState } from 'react'
import { Box, Group, Tabs, Text } from '@mantine/core'
import MergeMode from './components/MergeMode'
import SplitMode from './components/SplitMode'

type AppMode = 'split' | 'merge'

export default function App() {
  const [mode, setMode] = useState<AppMode>('split')
  const [splitInitialPath, setSplitInitialPath] = useState<string | null>(null)

  const handleOpenInSplitMode = (path: string) => {
    setSplitInitialPath(path)
    setMode('split')
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Box
        component="header"
        style={{
          height: 48,
          flexShrink: 0,
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          display: 'flex',
          alignItems: 'center',
          paddingInline: 'var(--mantine-spacing-md)',
        }}
      >
        <Group justify="space-between" style={{ width: '100%' }}>
          <Text fw={600} size="sm">Paper Scan Processor</Text>
          <Tabs value={mode} onChange={(v) => v && setMode(v as AppMode)}>
            <Tabs.List>
              <Tabs.Tab value="split">Split</Tabs.Tab>
              <Tabs.Tab value="merge">Merge</Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Group>
      </Box>
      <Box style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'split'
          ? <SplitMode initialPath={splitInitialPath} />
          : <MergeMode onOpenInSplitMode={handleOpenInSplitMode} />}
      </Box>
    </Box>
  )
}
