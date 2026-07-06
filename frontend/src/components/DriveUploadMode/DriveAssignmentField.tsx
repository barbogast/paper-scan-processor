import { Box, Text } from '@mantine/core'
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
    <Box style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        onClick={onPick}
        aria-label={`Set Drive folder for ${label}`}
        style={{
          flex: 1,
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          minWidth: 0,
        }}
      >
        <Text size="xs" c="dimmed" fs={!isOwn && assignment ? 'italic' : undefined} truncate="end">
          Drive: {assignment ? assignment.path : 'not assigned'}
        </Text>
      </button>
      {isOwn && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear Drive folder for ${label}`}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0 }}
        >
          <Text size="xs" c="dimmed">✕</Text>
        </button>
      )}
    </Box>
  )
}
