import { Box, Checkbox, Group, Stack, Text } from '@mantine/core'
import DriveAssignmentField from './DriveAssignmentField'
import TruncatedText from '../TruncatedText'
import FileList from './FileList'
import { LocalFile, LocalFileGroup } from './useFileTree'
import { DriveAssignment, DriveAssignmentsHandle, PickerTarget } from './useDriveAssignments'
import { InclusionHandle } from './useInclusion'
import { OpenDriveFolder } from '../../../wailsjs/go/main/App'
import { handlePromiseRejection } from '../../lib/globalErrorHandler'
import styles from './GroupNode.module.css'

const INDENT_PER_LEVEL = 16

interface Props {
  group: LocalFileGroup
  groupKey: string
  collapsedGroups: Set<string>
  onToggle: (groupKey: string) => void
  assignments: DriveAssignmentsHandle
  inheritedAssignment: DriveAssignment | null
  inclusion: InclusionHandle
  locked: boolean
  onPick: (target: PickerTarget) => void
  selectedPath: string | null
  onSelectFile: (file: LocalFile) => void
}

export default function GroupNode({ group, groupKey, collapsedGroups, onToggle, assignments, inheritedAssignment, inclusion, locked, onPick, selectedPath, onSelectFile }: Props) {
  const expanded = !collapsedGroups.has(groupKey)
  const own = assignments.groupAssignments.get(groupKey) ?? null
  const effective = own ?? inheritedAssignment
  const selectionState = inclusion.getGroupState(group)

  return (
    <Box>
      <Group gap={8} wrap="nowrap" align="center">
        <Checkbox
          size="xs"
          checked={selectionState === 'checked'}
          indeterminate={selectionState === 'indeterminate'}
          disabled={locked}
          onChange={() => inclusion.toggleGroup(group)}
          aria-label={`Include ${group.name} in upload`}
        />
        <button
          type="button"
          onClick={() => onToggle(groupKey)}
          aria-expanded={expanded}
          className={styles.toggle}
        >
          <Text size="xs" c="dimmed" className={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
          <TruncatedText label={group.name} size="sm" fw={600}>📁 {group.name}</TruncatedText>
        </button>
        <DriveAssignmentField
          label={group.name}
          assignment={effective}
          isOwn={own !== null}
          locked={locked}
          onPick={() => onPick({ type: 'group', key: groupKey })}
          onClear={() => assignments.clearGroupAssignment(groupKey)}
          onOpen={() => effective && OpenDriveFolder(effective.driveFolderId).catch(handlePromiseRejection('Opening Drive folder failed'))}
        />
      </Group>
      {expanded && (
        <Box pl={INDENT_PER_LEVEL}>
          <FileList
            files={group.files}
            assignments={assignments}
            inheritedAssignment={effective}
            inclusion={inclusion}
            locked={locked}
            onPick={onPick}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
          />
          {group.subgroups.length > 0 && (
            <Stack gap={8} mt={4}>
              {group.subgroups.map(sub => (
                <GroupNode
                  key={sub.name}
                  group={sub}
                  groupKey={`${groupKey}/${sub.name}`}
                  collapsedGroups={collapsedGroups}
                  onToggle={onToggle}
                  assignments={assignments}
                  inheritedAssignment={effective}
                  inclusion={inclusion}
                  locked={locked}
                  onPick={onPick}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  )
}
