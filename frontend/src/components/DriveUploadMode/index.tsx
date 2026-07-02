import { Box, Button, Loader, Stack, Text, Tooltip } from '@mantine/core'
import ClippedPath from '../ClippedPath'
import { useFileTree, LocalFile } from './useFileTree'
import { formatFileSize } from '../../utils'

const LEFT_PANEL_WIDTH = 300

export default function DriveUploadMode() {
  const { root, groups, loading, error, pickRoot } = useFileTree()
  const rootGroup = groups.find(g => g.name === '')
  const subfolderGroups = groups.filter(g => g.name !== '')

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

        {loading && <Loader size="sm" />}
        {error && <Text size="sm" c="red">{error}</Text>}
        {!loading && !error && root && groups.length === 0 && (
          <Text size="sm" c="dimmed">No PDF files found under this folder.</Text>
        )}
        {!loading && !root && (
          <Button size="xs" onClick={pickRoot}>Choose Root Folder</Button>
        )}

        <Stack gap="md" mt="sm">
          {subfolderGroups.map(group => (
            <Box key={group.name}>
              <Text size="sm" fw={600}>📁 {group.name}</Text>
              <FileList files={group.files} />
            </Box>
          ))}
          {rootGroup && <FileList files={rootGroup.files} />}
        </Stack>
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

function FileList({ files }: { files: LocalFile[] }) {
  return (
    <Stack gap={6} mt={4}>
      {files.map(file => (
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
        </Box>
      ))}
    </Stack>
  )
}
