import { useState, useEffect } from 'react'
import { Box, Button, Loader, Stack, Text } from '@mantine/core'
import DetailPanel from '../DetailPanel'
import Toolbar from '../Toolbar'
import DriveFolderPickerModal from './DriveFolderPickerModal'
import DriveThumbnailPanel from './ThumbnailPanel'
import GroupNode from './GroupNode'
import FileList from './FileList'
import ResizableLeftPanel from './ResizableLeftPanel'
import { useFileTree, LocalFile } from './useFileTree'
import { useDriveAssignments, DriveAssignment, PickerTarget } from './useDriveAssignments'
import * as pageCache from '../../lib/pageCache'
import { ellipsisPath } from '../../utils'

export default function DriveUploadMode() {
  const { root, tree, loading, error, pickRoot } = useFileTree()
  const isEmpty = tree !== null && tree.files.length === 0 && tree.subgroups.length === 0

  const [selectedFile, setSelectedFile] = useState<LocalFile | null>(null)
  const [selectedPage, setSelectedPage] = useState(1)
  const handleSelectFile = (file: LocalFile) => {
    setSelectedFile(file)
    setSelectedPage(1)
  }

  useEffect(() => {
    return () => { if (selectedFile) pageCache.evict(selectedFile.path) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.path])

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
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Button size="xs" variant="default" onClick={pickRoot}>
          {root ? ellipsisPath(root) : 'Choose root folder…'}
        </Button>
      </Toolbar>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <ResizableLeftPanel
          left={
            <>
              <DriveFolderPickerModal
                opened={pickerTarget !== null}
                onClose={() => setPickerTarget(null)}
                onSelect={handlePicked}
              />

              {loading && <Loader size="sm" />}
              {error && <Text size="sm" c="red">{error}</Text>}
              {!loading && !error && isEmpty && (
                <Text size="sm" c="dimmed">No files found under this folder.</Text>
              )}

              {tree && (
                <Stack gap="md">
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
                      selectedPath={selectedFile?.path ?? null}
                      onSelectFile={handleSelectFile}
                    />
                  ))}
                  <FileList
                    files={tree.files}
                    assignments={assignments}
                    inheritedAssignment={null}
                    onPick={setPickerTarget}
                    selectedPath={selectedFile?.path ?? null}
                    onSelectFile={handleSelectFile}
                  />
                </Stack>
              )}
            </>
          }
        >
          <DriveThumbnailPanel
            pdfPath={selectedFile?.path ?? null}
            pageCount={selectedFile?.pageCount ?? 0}
            selectedPage={selectedPage}
            onSelectPage={setSelectedPage}
          />

          {selectedFile
            ? <DetailPanel pdfPath={selectedFile.path} pageNum={selectedPage} pageCount={selectedFile.pageCount} />
            : <Box style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />}
        </ResizableLeftPanel>
      </Box>
    </Box>
  )
}
