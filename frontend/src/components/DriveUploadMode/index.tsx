import { useState } from 'react'
import { Box, Button, Loader, Stack, Text } from '@mantine/core'
import ClippedPath from '../ClippedPath'
import DriveFolderPickerModal from './DriveFolderPickerModal'
import GroupNode from './GroupNode'
import FileList from './FileList'
import ResizableLeftPanel from './ResizableLeftPanel'
import { useFileTree } from './useFileTree'
import { useDriveAssignments, DriveAssignment, PickerTarget } from './useDriveAssignments'

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
    <ResizableLeftPanel
      left={
        <>
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
        </>
      }
    >
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
    </ResizableLeftPanel>
  )
}
