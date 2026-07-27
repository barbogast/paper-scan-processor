import { ReactNode } from 'react'
import { Box, Group } from '@mantine/core'
import styles from './Toolbar.module.css'

interface Props {
  children: ReactNode
}

// Full-width toolbar strip above a mode's main content. Shared by Split and
// Drive Upload mode; Merge mode's toolbar has a different shape (full-height
// side columns) and doesn't fit this.
export default function Toolbar({ children }: Props) {
  return (
    <Box className={styles.toolbar}>
      <Group gap={8} className={styles.group}>
        {children}
      </Group>
    </Box>
  )
}
