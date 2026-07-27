import { useState } from 'react'
import { Box, Group, Tabs, Text } from '@mantine/core'
import MergeMode from './components/MergeMode'
import SplitMode from './components/SplitMode'
import DriveUploadMode from './components/DriveUploadMode'
import styles from './App.module.css'

type AppMode = 'split' | 'merge' | 'drive'

export default function App() {
  const [mode, setMode] = useState<AppMode>('split')
  const [splitInitialPath, setSplitInitialPath] = useState<string | null>(null)

  const handleOpenInSplitMode = (path: string) => {
    setSplitInitialPath(path)
    setMode('split')
  }

  return (
    <Box className={styles.app}>
      <Box component="header" className={styles.header}>
        <Group justify="space-between" className={styles.headerGroup}>
          <Text fw={600} size="sm">Paper Scan Processor</Text>
          <Tabs value={mode} onChange={(v) => v && setMode(v as AppMode)}>
            <Tabs.List>
              <Tabs.Tab value="split">Split</Tabs.Tab>
              <Tabs.Tab value="merge">Merge</Tabs.Tab>
              <Tabs.Tab value="drive">Drive Upload</Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Group>
      </Box>
      <Box className={styles.content}>
        {mode === 'split' && <SplitMode initialPath={splitInitialPath} />}
        {mode === 'merge' && <MergeMode onOpenInSplitMode={handleOpenInSplitMode} />}
        {mode === 'drive' && <DriveUploadMode />}
      </Box>
    </Box>
  )
}
