import { Badge, Box, Checkbox, Group, Stack, Text, Tooltip } from '@mantine/core'
import DriveAssignmentField from './DriveAssignmentField'
import TruncatedText from '../TruncatedText'
import { LocalFile } from './useFileTree'
import { DriveAssignment, DriveAssignmentsHandle, PickerTarget } from './useDriveAssignments'
import { InclusionHandle } from './useInclusion'
import { OpenDriveFolder } from '../../../wailsjs/go/main/App'
import { handlePromiseRejection } from '../../lib/globalErrorHandler'
import { formatFileSize } from '../../utils'
import styles from './FileList.module.css'

interface Props {
  files: LocalFile[]
  assignments: DriveAssignmentsHandle
  inheritedAssignment: DriveAssignment | null
  inclusion: InclusionHandle
  locked: boolean
  onPick: (target: PickerTarget) => void
  selectedPath: string | null
  onSelectFile: (file: LocalFile) => void
}

export default function FileList({ files, assignments, inheritedAssignment, inclusion, locked, onPick, selectedPath, onSelectFile }: Props) {
  return (
    <Stack gap={10} mt={4}>
      {files.map(file => {
        const own = assignments.fileOverrides.get(file.path) ?? null
        const effective = own ?? inheritedAssignment
        const previewable = file.isPdf && !file.corrupt
        const detail = [
          file.corrupt ? 'Unreadable' : file.isPdf ? `${file.pageCount} pages` : null,
          formatFileSize(file.sizeBytes),
        ].filter(Boolean).join(' · ')
        return (
          <Box
            key={file.path}
            pl={4}
            py={2}
            onClick={() => previewable && onSelectFile(file)}
            className={`${styles.row} ${previewable ? styles.rowClickable : styles.rowNotClickable} ${selectedPath === file.path ? styles.rowSelected : ''}`}
          >
            <Group gap={8} wrap="nowrap" align="center">
              <Checkbox
                size="xs"
                checked={inclusion.isFileSelected(file.path)}
                disabled={locked}
                onChange={() => inclusion.toggleFile(file.path)}
                aria-label={`Include ${file.name} in upload`}
              />
              <Group gap={4} wrap="nowrap" className={styles.nameGroup}>
                {file.isPdf && (
                  <Badge size="xs" variant="light" color="red" radius="sm" className={styles.pdfBadge}>
                    PDF
                  </Badge>
                )}
                <TruncatedText label={file.name} size="sm" c={file.corrupt ? 'red' : undefined}>
                  {file.isPdf ? '' : '📄 '}{file.name}
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
                locked={locked}
                onPick={() => onPick({ type: 'file', path: file.path })}
                onClear={() => assignments.clearFileOverride(file.path)}
                onOpen={() => effective && OpenDriveFolder(effective.driveFolderId).catch(handlePromiseRejection('Opening Drive folder failed'))}
              />
            </Group>
            <Text size="xs" c="dimmed" mt={2}>
              {detail}
            </Text>
          </Box>
        )
      })}
    </Stack>
  )
}
