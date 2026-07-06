import { Box, Stack, Text } from '@mantine/core'
import DriveAssignmentField from './DriveAssignmentField'
import FileList from './FileList'
import { LocalFileGroup } from './useFileTree'
import { DriveAssignment, DriveAssignmentsHandle, PickerTarget } from './useDriveAssignments'

const INDENT_PER_LEVEL = 16

interface Props {
  group: LocalFileGroup
  groupKey: string
  collapsedGroups: Set<string>
  onToggle: (groupKey: string) => void
  assignments: DriveAssignmentsHandle
  inheritedAssignment: DriveAssignment | null
  onPick: (target: PickerTarget) => void
}

export default function GroupNode({ group, groupKey, collapsedGroups, onToggle, assignments, inheritedAssignment, onPick }: Props) {
  const expanded = !collapsedGroups.has(groupKey)
  const own = assignments.groupAssignments.get(groupKey) ?? null
  const effective = own ?? inheritedAssignment

  return (
    <Box>
      <button
        type="button"
        onClick={() => onToggle(groupKey)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <Text size="xs" c="dimmed" style={{ width: 10, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</Text>
        <Text size="sm" fw={600}>📁 {group.name}</Text>
      </button>
      <DriveAssignmentField
        label={group.name}
        assignment={effective}
        isOwn={own !== null}
        onPick={() => onPick({ type: 'group', key: groupKey })}
        onClear={() => assignments.clearGroupAssignment(groupKey)}
      />
      {expanded && (
        <Box pl={INDENT_PER_LEVEL}>
          <FileList files={group.files} assignments={assignments} inheritedAssignment={effective} onPick={onPick} />
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
                  onPick={onPick}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  )
}
