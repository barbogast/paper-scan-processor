import { useState } from 'react'
import { Box, Button, Loader, Stack, Text, Tooltip } from '@mantine/core'
import ClippedPath from '../ClippedPath'
import DriveFolderPickerModal from './DriveFolderPickerModal'
import { useFileTree, LocalFile, LocalFileGroup } from './useFileTree'
import { useDriveAssignments, DriveAssignment, DriveAssignmentsHandle } from './useDriveAssignments'
import { formatFileSize } from '../../utils'

const LEFT_PANEL_WIDTH = 300
const INDENT_PER_LEVEL = 16

type PickerTarget = { type: 'group'; key: string } | { type: 'file'; path: string }

export default function DriveUploadMode() {
  const { root, tree, loading, error, pickRoot } = useFileTree()
  const isEmpty = tree !== null && tree.files.length === 0 && tree.subgroups.length === 0

  // Groups start expanded; presence in this set (keyed by the group's full
  // path, e.g. "invoices/2026") means collapsed.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey)
      return next
    })
  }

  const assignments = useDriveAssignments()
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null)
  const handlePicked = (folder: DriveAssignment) => {
    if (pickerTarget?.type === 'group') assignments.setGroupAssignment(pickerTarget.key, folder)
    else if (pickerTarget?.type === 'file') assignments.setFileOverride(pickerTarget.path, folder)
    setPickerTarget(null)
  }

  return (
    <Box style={{ display: 'flex', height: '100%' }}>
      <Box
        style={{
          width: LEFT_PANEL_WIDTH,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderRight: '1px solid var(--mantine-color-gray-3)',
          padding: 12,
        }}
      >
        <Box mb="sm">
          <ClippedPath path={root} onClick={pickRoot} placeholder="Choose root folder…" />
        </Box>

        <DriveFolderPickerModal
          opened={pickerTarget !== null}
          onClose={() => setPickerTarget(null)}
          onSelect={handlePicked}
        />

        {loading && <Loader size="sm" />}
        {error && <Text size="sm" c="red">{error}</Text>}
        {!loading && !error && isEmpty && (
          <Text size="sm" c="dimmed">No PDF files found under this folder.</Text>
        )}
        {!loading && !root && (
          <Button size="xs" onClick={pickRoot}>Choose Root Folder</Button>
        )}

        {tree && (
          <Stack gap="md" mt="sm">
            {tree.subgroups.map(group => (
              <GroupNode
                key={group.name}
                group={group}
                groupKey={group.name}
                collapsedGroups={collapsedGroups}
                onToggle={toggleGroup}
                assignments={assignments}
                inheritedAssignment={null}
                onPick={setPickerTarget}
              />
            ))}
            <FileList files={tree.files} assignments={assignments} inheritedAssignment={null} onPick={setPickerTarget} />
          </Stack>
        )}
      </Box>

      <Box
        style={{
          flex: '0 0 auto', width: 220, height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--mantine-color-gray-1)',
          borderRight: '1px solid var(--mantine-color-gray-3)',
        }}
      >
        <Text size="sm" c="dimmed">Select a file to preview</Text>
      </Box>

      <Box style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
    </Box>
  )
}

interface GroupNodeProps {
  group: LocalFileGroup
  groupKey: string
  collapsedGroups: Set<string>
  onToggle: (groupKey: string) => void
  assignments: DriveAssignmentsHandle
  inheritedAssignment: DriveAssignment | null
  onPick: (target: PickerTarget) => void
}

function GroupNode({ group, groupKey, collapsedGroups, onToggle, assignments, inheritedAssignment, onPick }: GroupNodeProps) {
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

interface FileListProps {
  files: LocalFile[]
  assignments: DriveAssignmentsHandle
  inheritedAssignment: DriveAssignment | null
  onPick: (target: PickerTarget) => void
}

function FileList({ files, assignments, inheritedAssignment, onPick }: FileListProps) {
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

interface DriveAssignmentFieldProps {
  label: string
  assignment: DriveAssignment | null
  isOwn: boolean
  onPick: () => void
  onClear: () => void
}

function DriveAssignmentField({ label, assignment, isOwn, onPick, onClear }: DriveAssignmentFieldProps) {
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
