import { Badge, Box, Checkbox, Group, Stack, Text, Tooltip } from '@mantine/core'
import DriveAssignmentField from './DriveAssignmentField'
import TruncatedText from '../../TruncatedText'
import { DriveAssignmentsHandle } from '../hooks/useDriveAssignments'
import { InclusionHandle } from '../hooks/useInclusion'
import { SelectionHandle } from '../hooks/useSelection'
import { LocalFile, DriveAssignment, SelectionItem } from '../types'
import { OpenDriveFolder } from '../../../../wailsjs/go/main/App'
import { formatFileSize } from '../../../utils'
import styles from './FileList.module.css'

interface Props {
  files: LocalFile[]
  assignments: DriveAssignmentsHandle
  inheritedAssignment: DriveAssignment | null
  inclusion: InclusionHandle
  selection: SelectionHandle
  locked: boolean
  onPick: (target: SelectionItem) => void
  onPreviewFile: (file: LocalFile) => void
}

export default function FileList({ files, assignments, inheritedAssignment, inclusion, selection, locked, onPick, onPreviewFile }: Props) {
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
        const handleRowClick = (e: React.MouseEvent) => {
          const item = { type: 'file' as const, path: file.path }
          if (e.metaKey || e.ctrlKey) selection.toggle(item); else selection.replace(item)
          if (previewable) onPreviewFile(file)
        }
        return (
          <Box
            key={file.path}
            pl={4}
            py={2}
            onClick={handleRowClick}
            aria-selected={selection.isSelected({ type: 'file', path: file.path })}
            className={`${styles.row} ${styles.rowClickable} ${selection.isSelected({ type: 'file', path: file.path }) ? styles.rowSelected : ''}`}
          >
            <Group gap={8} wrap="nowrap" align="center">
              <Checkbox
                size="xs"
                checked={inclusion.isFileSelected(file.path)}
                disabled={locked}
                onClick={e => e.stopPropagation()}
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
              <Box onClick={e => e.stopPropagation()}>
                <DriveAssignmentField
                  label={file.name}
                  assignment={effective}
                  isOwn={own !== null}
                  locked={locked}
                  onPick={() => onPick({ type: 'file', path: file.path })}
                  onClear={() => assignments.clearFileOverride(file.path)}
                  onOpen={async () => { if (effective) await OpenDriveFolder(effective.driveFolderId) }}
                />
              </Box>
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
