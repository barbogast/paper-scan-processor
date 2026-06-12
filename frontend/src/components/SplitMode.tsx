import { Box, Center, Text } from '@mantine/core'

export default function SplitMode() {
  return (
    <Box style={{ display: 'flex', height: '100%' }}>
      <Box style={{ flex: 1, overflow: 'auto' }}>
        <Center style={{ height: '100%' }}>
          <Text c="dimmed">Drop a PDF here to begin</Text>
        </Center>
      </Box>
      <Box
        style={{
          width: 300,
          flexShrink: 0,
          borderLeft: '1px solid var(--mantine-color-gray-3)',
          overflow: 'auto',
          padding: 'var(--mantine-spacing-md)',
        }}
      >
        <Text fw={500} mb="xs">Output files</Text>
        <Text c="dimmed" size="sm">No split points defined yet</Text>
      </Box>
    </Box>
  )
}
