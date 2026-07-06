import { Badge, Box } from '@mantine/core'
import { DriveAssignment } from './useDriveAssignments'

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
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <Badge
        component="button"
        type="button"
        onClick={onPick}
        aria-label={`Set Drive folder for ${label}`}
        color={assignment ? 'blue' : 'gray'}
        variant={isOwn ? 'light' : 'outline'}
        size="sm"
        radius="sm"
        style={{ cursor: 'pointer', fontWeight: isOwn ? 600 : 400, textTransform: 'none', maxWidth: 140 }}
        styles={{ label: { overflow: 'hidden', textOverflow: 'ellipsis' } }}
      >
        📁 {assignment ? assignment.path : 'Not assigned'}
      </Badge>
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
