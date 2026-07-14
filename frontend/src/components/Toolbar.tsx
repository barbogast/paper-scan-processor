import { ReactNode } from 'react'
import { Box, Group } from '@mantine/core'

interface Props {
  children: ReactNode
}

// Full-width toolbar strip above a mode's main content. Shared by Split and
// Drive Upload mode; Merge mode's toolbar has a different shape (full-height
// side columns) and doesn't fit this.
export default function Toolbar({ children }: Props) {
  return (
    <Box
      style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        display: 'flex',
        alignItems: 'center',
        paddingInline: 12,
        height: 44,
      }}
    >
      <Group gap={8} style={{ width: '100%' }}>
        {children}
      </Group>
    </Box>
  )
}
