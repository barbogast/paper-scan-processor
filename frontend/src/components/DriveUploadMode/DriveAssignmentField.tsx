import { useRef } from 'react'
import { Badge, Box, Tooltip } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import { DriveAssignment } from './useDriveAssignments'
import { useIsTruncated } from '../../lib/useIsTruncated'
import styles from './DriveAssignmentField.module.css'

interface Props {
  label: string
  assignment: DriveAssignment | null
  isOwn: boolean
  // True once every file this assignment covers has finished uploading (so
  // assignment is non-null: nothing uploads without a resolved folder). The
  // destination is locked in at that point (see uploadQueue's read-only
  // rationale), so the badge opens the folder in Drive instead of the
  // picker, and the clear control disappears.
  uploaded: boolean
  onPick: () => void
  onClear: () => void
  onOpen: () => void
}

// Pinned to the right of its row (filename or folder header) by the caller,
// so badges land at a consistent horizontal position regardless of nesting
// depth - scannable as a column rather than a per-row detail.
export default function DriveAssignmentField({ label, assignment, isOwn, uploaded, onPick, onClear, onOpen }: Props) {
  const textRef = useRef<HTMLSpanElement>(null)
  const displayPath = assignment ? assignment.path : 'Not assigned'
  const truncated = useIsTruncated(textRef, displayPath)

  const badge = (
    <Badge
      component="button"
      type="button"
      onClick={uploaded ? onOpen : onPick}
      aria-label={uploaded ? `Open Drive folder for ${label}` : `Set Drive folder for ${label}`}
      color={assignment ? 'blue' : 'gray'}
      variant={isOwn ? 'light' : 'outline'}
      size="sm"
      radius="sm"
      rightSection={uploaded ? <IconExternalLink size={10} /> : undefined}
      className={`${styles.badge} ${isOwn ? styles.badgeOwn : ''}`}
      styles={{ label: { overflow: 'hidden' } }}
    >
      <span ref={textRef} className={styles.badgeText}>
        📁 {displayPath}
      </span>
    </Badge>
  )

  return (
    <Box className={styles.container}>
      {truncated ? <Tooltip label={displayPath} openDelay={500}>{badge}</Tooltip> : badge}
      {isOwn && !uploaded && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear Drive folder for ${label}`}
          className={styles.clearButton}
        >
          ✕
        </button>
      )}
    </Box>
  )
}
