import { Box, Group, Stack, Text, Tooltip } from '@mantine/core'
import DriveAssignmentField from './DriveAssignmentField'
import TruncatedText from './TruncatedText'
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
    <Stack gap={10} mt={4}>
      {files.map(file => {
        const own = assignments.fileOverrides.get(file.path) ?? null
        const effective = own ?? inheritedAssignment
        return (
          <Box key={file.path} pl={4}>
            <Group gap={8} wrap="nowrap" align="center">
              <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                <TruncatedText label={file.name} size="sm" c={file.corrupt ? 'red' : undefined}>
                  📄 {file.name}
                </TruncatedText>
                {file.corrupt && (
                  <Tooltip label="Could not read this file — it may be corrupt or not a valid PDF">
                    <span>⚠️</span>
                  </Tooltip>
                )}
              </Group>
              <DriveAssignmentField
                label={file.name}
                assignment={effective}
                isOwn={own !== null}
                onPick={() => onPick({ type: 'file', path: file.path })}
                onClear={() => assignments.clearFileOverride(file.path)}
              />
            </Group>
            <Text size="xs" c="dimmed" mt={2}>
              {file.corrupt ? 'Unreadable' : `${file.pageCount} pages`} · {formatFileSize(file.sizeBytes)}
            </Text>
          </Box>
        )
      })}
    </Stack>
  )
}
