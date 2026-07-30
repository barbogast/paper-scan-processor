import { ActionIcon, Box, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import TruncatedText from '../../TruncatedText'
import { flattenFiles } from '../hooks/useFileTree'
import * as uploadQueue from '../uploadQueue'
import { LocalFile, LocalFileGroup } from '../types'
import { OpenDriveFolder } from '../../../../wailsjs/go/main/App'
import { handlePromiseRejection } from '../../../lib/globalErrorHandler'
import styles from './UploadModal.module.css'

interface Props {
  opened: boolean
  tree: LocalFileGroup
  onClose: () => void
}

// Per-file status lives in the uploadQueue module singleton, not in this
// component's state — it re-renders by subscribing, the same pattern
// lib/pageCache's consumers use.
export default function UploadModal({ opened, tree, onClose }: Props) {
  uploadQueue.useUploadQueueRender()

  const paths = flattenFiles(tree).map(f => f.path)
  const settled = uploadQueue.hasSettled(paths)
  const canResume = settled && uploadQueue.hasPaused(paths)

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Uploading to Drive"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      size="md"
    >
      <Stack gap="md">
        <Stack gap={10}>
          {tree.files.map(file => <FileRow key={file.path} file={file} />)}
          {tree.subgroups.map(group => (
            <GroupSection key={group.name} group={group} />
          ))}
        </Stack>
        <Group justify="flex-end">
          <Button
            variant="default"
            disabled={settled && !canResume}
            onClick={() => (canResume ? uploadQueue.resumePaused(paths) : uploadQueue.cancelAll())}
          >
            {canResume ? 'Resume' : 'Cancel'}
          </Button>
          <Button disabled={!settled} onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function GroupSection({ group }: { group: LocalFileGroup }) {
  const groupFiles = flattenFiles(group)
  const doneCount = groupFiles.filter(f => uploadQueue.getStatus(f.path)?.status === 'done').length

  return (
    <Box pl={12}>
      <Group justify="space-between" gap={8} mb={4} wrap="nowrap">
        <TruncatedText label={group.name} size="sm" fw={600}>📁 {group.name}</TruncatedText>
        <Text size="xs" c="dimmed" className={styles.groupCount}>{doneCount}/{groupFiles.length}</Text>
      </Group>
      <Stack gap={10}>
        {group.files.map(file => <FileRow key={file.path} file={file} />)}
        {group.subgroups.map(sub => (
          <GroupSection key={sub.name} group={sub} />
        ))}
      </Stack>
    </Box>
  )
}

function FileRow({ file }: { file: LocalFile }) {
  const entry = uploadQueue.getStatus(file.path)
  const status = entry?.status

  return (
    <Group justify="space-between" wrap="nowrap" gap={8}>
      <TruncatedText label={file.name} size="sm" className={styles.fileName}>{file.name}</TruncatedText>
      {status === 'queued' && <Text size="sm" c="dimmed">Queued</Text>}
      {status === 'uploading' && (
        <Group gap={6} wrap="nowrap">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">Uploading…</Text>
        </Group>
      )}
      {status === 'done' && <Text size="sm" c="green">✓ Uploaded</Text>}
      {(status === undefined || status === 'paused') && <Text size="sm" c="dimmed">Not uploaded</Text>}
      {status === 'cancelled' && (
        <Group gap={8} wrap="nowrap">
          <Text size="sm" c="dimmed">Cancelled</Text>
          <Button size="xs" variant="default" onClick={() => uploadQueue.retry(entry!)}>
            Retry
          </Button>
        </Group>
      )}
      {status === 'error' && (
        <Group gap={8} wrap="nowrap">
          <TruncatedText label={entry?.error ?? ''} size="sm" c="red" className={styles.errorText}>
            ⚠ {entry?.error}
          </TruncatedText>
          <Button size="xs" variant="default" onClick={() => uploadQueue.retry(entry!)}>
            Retry
          </Button>
        </Group>
      )}
      {entry && (
        <ActionIcon
          variant="subtle"
          size="sm"
          aria-label={`Open destination Drive folder for ${file.name}`}
          onClick={() => OpenDriveFolder(entry.folderId).catch(handlePromiseRejection('Opening Drive folder failed'))}
        >
          <IconExternalLink size={14} />
        </ActionIcon>
      )}
    </Group>
  )
}
