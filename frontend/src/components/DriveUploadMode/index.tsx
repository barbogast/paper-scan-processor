import { useState, useEffect } from 'react'
import { Box, Button, Loader, Stack, Text, Tooltip } from '@mantine/core'
import DetailPanel from '../DetailPanel'
import Toolbar from '../Toolbar'
import TruncatedText from '../TruncatedText'
import DriveFolderPickerModal from './components/DriveFolderPickerModal'
import DriveThumbnailPanel from './components/ThumbnailPanel'
import GroupNode from './components/GroupNode'
import FileList from './components/FileList'
import ResizableLeftPanel from './components/ResizableLeftPanel'
import UploadModal from './components/UploadModal'
import { useFileTree, flattenFiles } from './hooks/useFileTree'
import { useDriveAssignments, resolveEffectiveAssignments } from './hooks/useDriveAssignments'
import { useInclusion } from './hooks/useInclusion'
import { useSelection } from './hooks/useSelection'
import { pruneSelectionForAssignment } from './pruneSelection'
import { LocalFile, DriveAssignment, SelectionItem } from './types'
import * as uploadQueue from './uploadQueue'
import * as pageCache from '../../lib/pageCache'
import { ellipsisPath } from '../../utils'
import styles from './index.module.css'

export default function DriveUploadMode() {
  const { root, tree, loading, error, pickRoot } = useFileTree()
  const isEmpty = tree !== null && tree.files.length === 0 && tree.subgroups.length === 0

  // The last previewable file touched by a click — independent of the
  // multi-selection (see useSelection): any click on a previewable file
  // updates this, whether it's adding or removing that file from the
  // selection, while clicking a subfolder or a non-previewable file leaves
  // it as whatever was last previewed.
  const [previewedFile, setPreviewedFile] = useState<LocalFile | null>(null)
  const [previewedPage, setPreviewedPage] = useState(1)
  const handlePreviewFile = (file: LocalFile) => {
    setPreviewedFile(file)
    setPreviewedPage(1)
  }

  useEffect(() => {
    return () => { if (previewedFile) pageCache.evict(previewedFile.path) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewedFile?.path])

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

  const inclusion = useInclusion(tree)
  const selection = useSelection(tree)
  const assignments = useDriveAssignments()
  // One or more targets for the currently open folder picker: a single-item
  // array for a per-row badge click, or the pruned multi-selection for the
  // toolbar batch action below — either way, the picked folder applies to
  // every target here.
  const [pickerTargets, setPickerTargets] = useState<SelectionItem[] | null>(null)
  const handlePicked = (folder: DriveAssignment) => {
    for (const target of pickerTargets ?? []) {
      if (target.type === 'group') assignments.setGroupAssignment(target.key, folder)
      else assignments.setFileOverride(target.path, folder)
    }
    setPickerTargets(null)
  }
  const handleBatchAssign = () => {
    if (!tree) return
    setPickerTargets(pruneSelectionForAssignment(tree, selection.items))
  }

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  // Once Upload All is clicked, the tree locks for the rest of this tree's
  // session — the upload starts immediately, so there's no "in progress but
  // not locked yet" window to account for. Retrying failed files happens
  // inside the upload modal, not from here, so this never needs to go back
  // to false except via a fresh root pick.
  const [started, setStarted] = useState(false)
  const allFiles = tree ? flattenFiles(tree) : []
  const selectedFiles = allFiles.filter(f => inclusion.isFileSelected(f.path))
  const effectiveAssignments = tree ? resolveEffectiveAssignments(tree, assignments) : null
  const readyToUpload = selectedFiles.length > 0 && selectedFiles.every(f => effectiveAssignments!.get(f.path) != null)

  const handleUploadAll = () => {
    if (!tree || !effectiveAssignments) return
    uploadQueue.start(selectedFiles.map(f => {
      const assignment = effectiveAssignments.get(f.path)
      // Upload All is disabled until readyToUpload is true, so every file
      // should resolve here — this is a defensive check against that
      // guard and this walk drifting out of sync, not an expected path.
      if (!assignment) throw new Error(`No Drive folder assigned for "${f.path}"`)
      return { path: f.path, folderId: assignment.driveFolderId, name: f.name }
    }))
    setStarted(true)
    setUploadModalOpen(true)
  }
  const handlePickRoot = async () => {
    // A new root discards the old tree's upload-queue state along with it —
    // picking a new root is the only way out of the read-only lock.
    if (await pickRoot()) {
      uploadQueue.reset()
      setStarted(false)
    }
  }

  return (
    <Box className={styles.root}>
      <Toolbar>
        <Button size="xs" variant="default" onClick={handlePickRoot}>
          {root ? ellipsisPath(root) : 'Choose root folder…'}
        </Button>
        <Box className={styles.toolbarSpacer} />
        <Button size="xs" variant="default" disabled={started || !tree} onClick={inclusion.selectAll}>
          Select All
        </Button>
        <Button size="xs" variant="default" disabled={started || !tree} onClick={inclusion.selectNone}>
          Select None
        </Button>
        <Button size="xs" variant="default" disabled={started || !tree || selection.size === 0} onClick={handleBatchAssign}>
          Assign Drive folder…
        </Button>
        <Tooltip
          label={tree ? 'Every selected file needs a Drive folder before uploading' : 'Choose a root folder first'}
          disabled={started || readyToUpload}
        >
          <span>
            <Button size="xs" disabled={started || !readyToUpload} onClick={handleUploadAll}>
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
                opened={pickerTargets !== null}
                onClose={() => setPickerTargets(null)}
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
                      inclusion={inclusion}
                      selection={selection}
                      locked={started}
                      onPick={target => setPickerTargets([target])}
                      onPreviewFile={handlePreviewFile}
                    />
                  ))}
                  <FileList
                    files={tree.files}
                    assignments={assignments}
                    inheritedAssignment={null}
                    inclusion={inclusion}
                    selection={selection}
                    locked={started}
                    onPick={target => setPickerTargets([target])}
                    onPreviewFile={handlePreviewFile}
                  />
                </Stack>
              )}
            </>
          }
        >
          <DriveThumbnailPanel
            pdfPath={previewedFile?.path ?? null}
            pageCount={previewedFile?.pageCount ?? 0}
            selectedPage={previewedPage}
            onSelectPage={setPreviewedPage}
          />

          <Box className={styles.detailColumn}>
            {previewedFile && (
              <TruncatedText label={previewedFile.name} size="sm" fw={600} className={styles.detailHeading}>
                {previewedFile.name}
              </TruncatedText>
            )}
            {previewedFile
              ? <DetailPanel pdfPath={previewedFile.path} pageNum={previewedPage} pageCount={previewedFile.pageCount} />
              : <Box className={styles.emptyDetail} />}
          </Box>
        </ResizableLeftPanel>
      </Box>
    </Box>
  )
}
