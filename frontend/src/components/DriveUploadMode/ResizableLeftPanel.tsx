import { useState, ReactNode } from 'react'
import { Box } from '@mantine/core'
import { makeResizeDragHandler } from '../../lib/resizableWidth'
import ResizeHandle from '../ResizeHandle'
import styles from './ResizableLeftPanel.module.css'

const DEFAULT_LEFT_PANEL_WIDTH = 300
const MIN_LEFT_PANEL_WIDTH = 180
const MAX_LEFT_PANEL_WIDTH = 600

interface Props {
  left: ReactNode
  children: ReactNode
}

// Owns the drag-resize width state itself so that dragging the handle only
// re-renders this component, not the (possibly large, unmemoized) `left`
// and `children` trees passed in from the parent's last render.
export default function ResizableLeftPanel({ left, children }: Props) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH)
  const startDrag = makeResizeDragHandler(leftWidth, setLeftWidth, MIN_LEFT_PANEL_WIDTH, MAX_LEFT_PANEL_WIDTH)

  return (
    <Box className={styles.outer}>
      <Box className={styles.left} style={{ width: leftWidth }}>
        {left}
      </Box>

      <ResizeHandle onMouseDown={startDrag} />

      {children}
    </Box>
  )
}
