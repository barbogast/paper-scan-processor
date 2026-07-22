import { Box, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import TruncatedText from '../TruncatedText'
import { LocalFile, LocalFileGroup, flattenFiles } from './useFileTree'
import * as uploadQueue from './uploadQueue'

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

  const settled = uploadQueue.hasSettled(flattenFiles(tree).map(f => f.path))

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
            <GroupSection key={group.name} group={group} groupKey={group.name} />
          ))}
        </Stack>
        <Group justify="flex-end">
          <Button variant="default" disabled={settled} onClick={() => uploadQueue.cancelRemaining()}>
            Cancel remaining
          </Button>
          <Button disabled={!settled} onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function GroupSection({ group, groupKey }: { group: LocalFileGroup; groupKey: string }) {
  const groupFiles = flattenFiles(group)
  const doneCount = groupFiles.filter(f => uploadQueue.getStatus(f.path)?.status === 'done').length

  return (
    <Box pl={12}>
      <Group justify="space-between" gap={8} mb={4} wrap="nowrap">
        <TruncatedText label={group.name} size="sm" fw={600}>📁 {group.name}</TruncatedText>
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{doneCount}/{groupFiles.length}</Text>
      </Group>
      <Stack gap={10}>
        {group.files.map(file => <FileRow key={file.path} file={file} />)}
        {group.subgroups.map(sub => (
          <GroupSection key={sub.name} group={sub} groupKey={`${groupKey}/${sub.name}`} />
        ))}
      </Stack>
    </Box>
  )
}

function FileRow({ file }: { file: LocalFile }) {
  const entry = uploadQueue.getStatus(file.path)
  const status = entry?.status ?? 'idle'

  return (
    <Group justify="space-between" wrap="nowrap" gap={8}>
      <TruncatedText label={file.name} size="sm" style={{ flex: 1, minWidth: 0 }}>{file.name}</TruncatedText>
      {status === 'queued' && <Text size="sm" c="dimmed">Queued</Text>}
      {status === 'uploading' && (
        <Group gap={6} wrap="nowrap">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">Uploading…</Text>
          <Button size="xs" variant="default" onClick={() => uploadQueue.cancel(file.path)}>
            Cancel
          </Button>
        </Group>
      )}
      {status === 'done' && <Text size="sm" c="green">✓ Uploaded</Text>}
      {status === 'idle' && <Text size="sm" c="dimmed">Not uploaded</Text>}
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
          <TruncatedText label={entry?.error ?? ''} size="sm" c="red" style={{ maxWidth: 220 }}>
            ⚠ {entry?.error}
          </TruncatedText>
          <Button size="xs" variant="default" onClick={() => uploadQueue.retry(entry!)}>
            Retry
          </Button>
        </Group>
      )}
    </Group>
  )
}
