import { useRef } from 'react'
import { Tooltip } from '@mantine/core'
import { useIsTruncated } from '../lib/useIsTruncated'
import styles from './ClippedPath.module.css'

interface Props {
  path: string | null
  onClick: () => void
  placeholder?: string
  disabled?: boolean
}

// Displays a filesystem path, anchored to its right end so the filename is always visible.
// Uses scrollLeft (rather than direction:rtl) to avoid Unicode BiDi issues with the leading slash.
export default function ClippedPath({ path, onClick, placeholder = 'Choose folder…', disabled }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const clipped = useIsTruncated(ref, path, { scrollToEnd: true })

  const inner = (
    <div className={styles.container}>
      {/* Overlay '…' at the left edge to signal that the path is truncated. */}
      {clipped && <span className={styles.ellipsis}>…</span>}
      <button
        type="button"
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        aria-label={path ? `Change destination folder (currently ${path})` : placeholder}
        className={`${styles.button} ${path ? styles.buttonWithPath : styles.buttonPlaceholder}`}
      >
        {path ?? placeholder}
      </button>
    </div>
  )

  return clipped && path
    ? <Tooltip label={path} openDelay={500}>{inner}</Tooltip>
    : inner
}
