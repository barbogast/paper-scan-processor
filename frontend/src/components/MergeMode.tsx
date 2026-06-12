import { Center, Stack, Text } from '@mantine/core'

export default function MergeMode() {
  return (
    <Center style={{ height: '100%' }}>
      <Stack align="center" gap="xs">
        <Text fw={500}>Merge Mode</Text>
        <Text c="dimmed" size="sm">Load two PDFs to interleave their pages</Text>
      </Stack>
    </Center>
  )
}
