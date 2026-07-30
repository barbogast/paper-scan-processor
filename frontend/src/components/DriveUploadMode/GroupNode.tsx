import { Box, Checkbox, Group, Stack, Text } from '@mantine/core'
import DriveAssignmentField from './DriveAssignmentField'
import TruncatedText from '../TruncatedText'
import FileList from './FileList'
import { DriveAssignmentsHandle } from './useDriveAssignments'
import { InclusionHandle } from './useInclusion'
import { SelectionHandle } from './useSelection'
import { LocalFile, LocalFileGroup, DriveAssignment, SelectionItem } from './types'
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
  selection: SelectionHandle
  locked: boolean
  onPick: (target: SelectionItem) => void
  onPreviewFile: (file: LocalFile) => void
}

export default function GroupNode({ group, groupKey, collapsedGroups, onToggle, assignments, inheritedAssignment, inclusion, selection, locked, onPick, onPreviewFile }: Props) {
  const expanded = !collapsedGroups.has(groupKey)
  const own = assignments.groupAssignments.get(groupKey) ?? null
  const effective = own ?? inheritedAssignment
  const inclusionState = inclusion.getGroupState(group)
  const selected = selection.isSelected({ type: 'group', key: groupKey })

  // Cmd/Ctrl-click toggles this group into/out of the shared selection. A
  // plain click replaces the selection with just this group, and — only as
  // a convenience when the selection held zero or one item beforehand —
  // also toggles expand/collapse, so building a multi-selection doesn't pop
  // groups open/closed as a side effect once it's under way.
  const onNameClick = (e: React.MouseEvent) => {
    const item = { type: 'group' as const, key: groupKey }
    if (e.metaKey || e.ctrlKey) {
      selection.toggle(item)
    } else {
      const hadZeroOrOne = selection.size <= 1
      selection.replace(item)
      if (hadZeroOrOne) onToggle(groupKey)
    }
  }

  return (
    <Box>
      <Group gap={8} wrap="nowrap" align="center" pl={4} py={2} aria-selected={selected} className={`${styles.row} ${selected ? styles.rowSelected : ''}`}>
        <Checkbox
          size="xs"
          checked={inclusionState === 'checked'}
          indeterminate={inclusionState === 'indeterminate'}
          disabled={locked}
          onChange={() => inclusion.toggleGroup(group)}
          aria-label={`Include ${group.name} in upload`}
        />
        <button
          type="button"
          onClick={() => onToggle(groupKey)}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${group.name}` : `Expand ${group.name}`}
          className={styles.chevronButton}
        >
          <Text size="xs" c="dimmed" className={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
        </button>
        <button
          type="button"
          onClick={onNameClick}
          className={styles.nameButton}
        >
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
            selection={selection}
            locked={locked}
            onPick={onPick}
            onPreviewFile={onPreviewFile}
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
                  selection={selection}
                  locked={locked}
                  onPick={onPick}
                  onPreviewFile={onPreviewFile}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  )
}
