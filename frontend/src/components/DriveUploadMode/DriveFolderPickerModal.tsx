import { useEffect, useState } from 'react'
import { Box, Button, Group, Loader, Modal, Text } from '@mantine/core'
import { ListDriveFolder } from '../../../wailsjs/go/main/App'
import { DriveAssignment } from './useDriveAssignments'

interface DriveFolder {
  id: string
  name: string
}

const ROOT: DriveFolder = { id: 'root', name: '/' }
const INDENT_PER_LEVEL = 16

interface DriveTreeNodeProps {
  item: DriveFolder
  path: string
  selectedId: string | null
  onSelect: (item: DriveFolder, path: string) => void
  defaultExpanded?: boolean
}

function DriveTreeNode({ item, path, selectedId, onSelect, defaultExpanded }: DriveTreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const [children, setChildren] = useState<DriveFolder[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await ListDriveFolder(item.id)
      setChildren(items.filter(i => i.isFolder).map(i => ({ id: i.id, name: i.name })))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (defaultExpanded && children === null) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = () => {
    if (!expanded && children === null) load()
    setExpanded(prev => !prev)
  }

  return (
    <Box>
      <Group gap={4} wrap="nowrap">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
          style={{ width: 16, flexShrink: 0, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
        >
          {loading ? <Loader size={10} /> : <Text size="xs" c="dimmed">{expanded ? '▼' : '▶'}</Text>}
        </button>
        <button
          type="button"
          onClick={() => onSelect(item, path)}
          style={{
            flex: 1,
            textAlign: 'left',
            border: 'none',
            padding: '2px 6px',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: item.id === selectedId ? 'var(--mantine-color-blue-1)' : 'transparent',
          }}
        >
          <Text size="sm" fw={item.id === selectedId ? 600 : 400}>📁 {item.name}</Text>
        </button>
      </Group>
      {error && <Text size="xs" c="red" pl={INDENT_PER_LEVEL + 6}>{error}</Text>}
      {expanded && children && (
        <Box pl={INDENT_PER_LEVEL}>
          {children.length === 0
            ? <Text size="xs" c="dimmed" pl={6}>No subfolders</Text>
            : children.map(child => (
                <DriveTreeNode
                  key={child.id}
                  item={child}
                  path={path.endsWith('/') ? `${path}${child.name}` : `${path}/${child.name}`}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              ))}
        </Box>
      )}
    </Box>
  )
}

interface Props {
  opened: boolean
  onClose: () => void
  onSelect: (folder: DriveAssignment) => void
}

export default function DriveFolderPickerModal({ opened, onClose, onSelect }: Props) {
  const [selected, setSelected] = useState<{ id: string; name: string; path: string } | null>(null)

  useEffect(() => {
    if (!opened) setSelected(null)
  }, [opened])

  const confirm = () => {
    if (!selected) return
    onSelect({ driveFolderId: selected.id, path: selected.path })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Choose a Drive folder" size="md">
      <Box style={{ maxHeight: 400, overflowY: 'auto' }}>
        <DriveTreeNode
          item={ROOT}
          path={ROOT.name}
          selectedId={selected?.id ?? null}
          onSelect={(item, path) => setSelected({ id: item.id, name: item.name, path })}
          defaultExpanded
        />
      </Box>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button disabled={!selected} onClick={confirm}>
          {selected ? `Select "${selected.name}"` : 'Select'}
        </Button>
      </Group>
    </Modal>
  )
}
