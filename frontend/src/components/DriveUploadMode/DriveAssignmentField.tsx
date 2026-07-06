import { Badge, Box } from '@mantine/core'
import { DriveAssignment } from './useDriveAssignments'

interface Props {
  label: string
  assignment: DriveAssignment | null
  isOwn: boolean
  onPick: () => void
  onClear: () => void
}

export default function DriveAssignmentField({ label, assignment, isOwn, onPick, onClear }: Props) {
  return (
    <Box mt={4} style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
      <Badge
        component="button"
        type="button"
        onClick={onPick}
        aria-label={`Set Drive folder for ${label}`}
        color={assignment ? 'blue' : 'gray'}
        variant={isOwn ? 'light' : 'outline'}
        size="sm"
        radius="sm"
        style={{ cursor: 'pointer', fontWeight: isOwn ? 600 : 400, textTransform: 'none', maxWidth: '100%', flexShrink: 1 }}
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
