import { useState, useEffect } from 'react'
import { Box, Button, Loader, Stack, Text, Tooltip } from '@mantine/core'
import DetailPanel from '../DetailPanel'
import Toolbar from '../Toolbar'
import DriveFolderPickerModal from './DriveFolderPickerModal'
import DriveThumbnailPanel from './ThumbnailPanel'
import GroupNode from './GroupNode'
import FileList from './FileList'
import ResizableLeftPanel from './ResizableLeftPanel'
import UploadModal from './UploadModal'
import { useFileTree, flattenFiles, LocalFile } from './useFileTree'
import { useDriveAssignments, resolveEffectiveAssignments, DriveAssignment, PickerTarget } from './useDriveAssignments'
import * as uploadQueue from './uploadQueue'
import * as pageCache from '../../lib/pageCache'
import { ellipsisPath } from '../../utils'
import styles from './index.module.css'

export default function DriveUploadMode() {
  // Subscribed here (not just in UploadModal) so GroupNode's "Open in Drive"
  // link appears in the tree as soon as a group finishes, even once the
  // modal has closed.
  uploadQueue.useUploadQueueRender()

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

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const allFiles = tree ? flattenFiles(tree) : []
  const effectiveAssignments = tree ? resolveEffectiveAssignments(tree, assignments) : null
  const readyToUpload = allFiles.length > 0 && allFiles.every(f => effectiveAssignments!.get(f.path) != null)
  const handleUploadAll = () => {
    if (!tree || !effectiveAssignments) return
    uploadQueue.start(allFiles.map(f => {
      const assignment = effectiveAssignments.get(f.path)
      // Upload All is disabled until readyToUpload is true, so every file
      // should resolve here — this is a defensive check against that
      // guard and this walk drifting out of sync, not an expected path.
      if (!assignment) throw new Error(`No Drive folder assigned for "${f.path}"`)
      return { path: f.path, folderId: assignment.driveFolderId, name: f.name }
    }))
    setUploadModalOpen(true)
  }

  return (
    <Box className={styles.root}>
      <Toolbar>
        <Button size="xs" variant="default" onClick={pickRoot}>
          {root ? ellipsisPath(root) : 'Choose root folder…'}
        </Button>
        <Box className={styles.toolbarSpacer} />
        <Tooltip
          label={tree ? 'Every file needs a Drive folder before uploading' : 'Choose a root folder first'}
          disabled={readyToUpload}
        >
          <span>
            <Button size="xs" disabled={!readyToUpload} onClick={handleUploadAll}>
              Upload All
            </Button>
          </span>
        </Tooltip>
      </Toolbar>

      <Box className={styles.body}>
        <ResizableLeftPanel
          left={
            <>
              <DriveFolderPickerModal
                opened={pickerTarget !== null}
                onClose={() => setPickerTarget(null)}
                onSelect={handlePicked}
              />
              {tree && (
                <UploadModal
                  opened={uploadModalOpen}
                  tree={tree}
                  onClose={() => setUploadModalOpen(false)}
                />
              )}

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
            : <Box className={styles.emptyDetail} />}
        </ResizableLeftPanel>
      </Box>
    </Box>
  )
}
