import { useRef } from 'react'
import { Badge, Box, Tooltip } from '@mantine/core'
import { DriveAssignment } from './useDriveAssignments'
import { useIsTruncated } from '../../lib/useIsTruncated'

interface Props {
  label: string
  assignment: DriveAssignment | null
  isOwn: boolean
  onPick: () => void
  onClear: () => void
}

// Pinned to the right of its row (filename or folder header) by the caller,
// so badges land at a consistent horizontal position regardless of nesting
// depth - scannable as a column rather than a per-row detail.
export default function DriveAssignmentField({ label, assignment, isOwn, onPick, onClear }: Props) {
  const textRef = useRef<HTMLSpanElement>(null)
  const displayPath = assignment ? assignment.path : 'Not assigned'
  const truncated = useIsTruncated(textRef, displayPath)

  const badge = (
    <Badge
      component="button"
      type="button"
      onClick={onPick}
      aria-label={`Set Drive folder for ${label}`}
      color={assignment ? 'blue' : 'gray'}
      variant={isOwn ? 'light' : 'outline'}
      size="sm"
      radius="sm"
      style={{ cursor: 'pointer', fontWeight: isOwn ? 600 : 400, textTransform: 'none', maxWidth: 220 }}
      styles={{ label: { overflow: 'hidden' } }}
    >
      <span ref={textRef} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        📁 {displayPath}
      </span>
    </Badge>
  )

  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      {truncated ? <Tooltip label={displayPath} openDelay={500}>{badge}</Tooltip> : badge}
      {isOwn && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear Drive folder for ${label}`}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0, opacity: 0.6 }}
        >
          ✕
        </button>
      )}
    </Box>
  )
}
