import { Box, Stack, Text, Tooltip } from '@mantine/core'
import DriveAssignmentField from './DriveAssignmentField'
import { LocalFile } from './useFileTree'
import { DriveAssignment, DriveAssignmentsHandle, PickerTarget } from './useDriveAssignments'
import { formatFileSize } from '../../utils'

interface Props {
  files: LocalFile[]
  assignments: DriveAssignmentsHandle
  inheritedAssignment: DriveAssignment | null
  onPick: (target: PickerTarget) => void
}

export default function FileList({ files, assignments, inheritedAssignment, onPick }: Props) {
  return (
    <Stack gap={6} mt={4}>
      {files.map(file => {
        const own = assignments.fileOverrides.get(file.path) ?? null
        const effective = own ?? inheritedAssignment
        return (
          <Box key={file.path} pl={4}>
            <Text size="sm" c={file.corrupt ? 'red' : undefined}>
              📄 {file.name}
              {file.corrupt && (
                <Tooltip label="Could not read this file — it may be corrupt or not a valid PDF">
                  <span> ⚠️</span>
                </Tooltip>
              )}
            </Text>
            <Text size="xs" c="dimmed">
              {file.corrupt ? 'Unreadable' : `${file.pageCount} pages`} · {formatFileSize(file.sizeBytes)}
            </Text>
            <DriveAssignmentField
              label={file.name}
              assignment={effective}
              isOwn={own !== null}
              onPick={() => onPick({ type: 'file', path: file.path })}
              onClear={() => assignments.clearFileOverride(file.path)}
            />
          </Box>
        )
      })}
    </Stack>
  )
}
