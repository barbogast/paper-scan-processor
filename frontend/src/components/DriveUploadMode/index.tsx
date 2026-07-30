import { useState } from 'react'
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
import { useFileTree } from './hooks/useFileTree'
import { useDriveAssignments } from './hooks/useDriveAssignments'
import { useInclusion } from './hooks/useInclusion'
import { useSelection } from './hooks/useSelection'
import { useUploadFlow } from './hooks/useUploadFlow'
import { usePreview } from './hooks/usePreview'
import { useDrivePicker } from './hooks/useDrivePicker'
import { ellipsisPath } from '../../utils'
import styles from './index.module.css'

export default function DriveUploadMode() {
  const { root, tree, loading, error, pickRoot } = useFileTree()
  const isEmpty = tree !== null && tree.files.length === 0 && tree.subgroups.length === 0

  const preview = usePreview()

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
  const picker = useDrivePicker(tree, selection, assignments)

  const uploadFlow = useUploadFlow(tree, inclusion, assignments)
  const handlePickRoot = async () => {
    if (await pickRoot()) uploadFlow.reset()
  }

  return (
    <Box className={styles.root}>
      <Toolbar>
        <Button size="xs" variant="default" onClick={handlePickRoot}>
          {root ? ellipsisPath(root) : 'Choose root folder…'}
        </Button>
        <Box className={styles.toolbarSpacer} />
        <Button size="xs" variant="default" disabled={uploadFlow.started || !tree} onClick={inclusion.selectAll}>
          Select All
        </Button>
        <Button size="xs" variant="default" disabled={uploadFlow.started || !tree} onClick={inclusion.selectNone}>
          Select None
        </Button>
        <Button size="xs" variant="default" disabled={uploadFlow.started || !tree || selection.size === 0} onClick={picker.pickSelection}>
          Assign Drive folder…
        </Button>
        <Tooltip
          label={tree ? 'Every selected file needs a Drive folder before uploading' : 'Choose a root folder first'}
          disabled={uploadFlow.started || uploadFlow.readyToUpload}
        >
          <span>
            <Button size="xs" disabled={uploadFlow.started || !uploadFlow.readyToUpload} onClick={uploadFlow.startUpload}>
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
                opened={picker.opened}
                onClose={picker.close}
                onSelect={picker.apply}
              />
              {tree && (
                <UploadModal
                  opened={uploadFlow.uploadModalOpen}
                  tree={tree}
                  onClose={uploadFlow.closeUploadModal}
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
                      locked={uploadFlow.started}
                      onPick={picker.pickOne}
                      onPreviewFile={preview.setFile}
                    />
                  ))}
                  <FileList
                    files={tree.files}
                    assignments={assignments}
                    inheritedAssignment={null}
                    inclusion={inclusion}
                    selection={selection}
                    locked={uploadFlow.started}
                    onPick={picker.pickOne}
                    onPreviewFile={preview.setFile}
                  />
                </Stack>
              )}
            </>
          }
        >
          <DriveThumbnailPanel
            pdfPath={preview.file?.path ?? null}
            pageCount={preview.file?.pageCount ?? 0}
            selectedPage={preview.page}
            onSelectPage={preview.setPage}
          />

          <Box className={styles.detailColumn}>
            {preview.file && (
              <TruncatedText label={preview.file.name} size="sm" fw={600} className={styles.detailHeading}>
                {preview.file.name}
              </TruncatedText>
            )}
            {preview.file
              ? <DetailPanel pdfPath={preview.file.path} pageNum={preview.page} pageCount={preview.file.pageCount} />
              : <Box className={styles.emptyDetail} />}
          </Box>
        </ResizableLeftPanel>
      </Box>
    </Box>
  )
}
