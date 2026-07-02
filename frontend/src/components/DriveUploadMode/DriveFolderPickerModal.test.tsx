import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import DriveFolderPickerModal from './DriveFolderPickerModal'
import { ListDriveFolder } from '../../../wailsjs/go/main/App'

vi.mock('../../../wailsjs/go/main/App', () => ({
  ListDriveFolder: vi.fn(),
}))

const ROOT_ITEMS = [
  { id: 'f1', name: 'Finance', isFolder: true, size: 0 },
  { id: 'file1', name: 'notes.txt', isFolder: false, size: 123 },
]
const FINANCE_ITEMS = [
  { id: 'f2', name: 'Invoices', isFolder: true, size: 0 },
]

function setup() {
  const onClose = vi.fn()
  const onSelect = vi.fn()
  render(
    <MantineProvider>
      <DriveFolderPickerModal opened onClose={onClose} onSelect={onSelect} />
    </MantineProvider>
  )
  return { onClose, onSelect }
}

beforeEach(() => {
  vi.mocked(ListDriveFolder).mockReset()
  vi.mocked(ListDriveFolder).mockImplementation(async (folderID: string) => {
    if (folderID === 'root') return ROOT_ITEMS as any
    if (folderID === 'f1') return FINANCE_ITEMS as any
    return []
  })
})

describe('DriveFolderPickerModal', () => {
  it('loads root-level folders and filters out files', async () => {
    setup()
    expect(await screen.findByText(/Finance/)).toBeTruthy()
    expect(screen.queryByText(/notes\.txt/)).toBeNull()
  })

  it('expands lazily and does not refetch on collapse/re-expand', async () => {
    setup()
    await screen.findByText(/Finance/)

    fireEvent.click(screen.getByRole('button', { name: 'Expand Finance' }))
    expect(await screen.findByText(/Invoices/)).toBeTruthy()
    expect(vi.mocked(ListDriveFolder)).toHaveBeenCalledWith('f1')
    expect(vi.mocked(ListDriveFolder).mock.calls.filter(c => c[0] === 'f1')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Finance' }))
    expect(screen.queryByText(/Invoices/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand Finance' }))
    expect(await screen.findByText(/Invoices/)).toBeTruthy()
    expect(vi.mocked(ListDriveFolder).mock.calls.filter(c => c[0] === 'f1')).toHaveLength(1)
  })

  it('selecting a folder enables Select, which reports id and path', async () => {
    const { onClose, onSelect } = setup()
    await screen.findByText(/Finance/)

    fireEvent.click(screen.getByRole('button', { name: '📁 Finance' }))
    const selectButton = screen.getByRole('button', { name: 'Select "Finance"' })
    fireEvent.click(selectButton)

    expect(onSelect).toHaveBeenCalledWith({ id: 'f1', path: 'My Drive / Finance' })
    expect(onClose).toHaveBeenCalled()
  })

  it('Cancel closes without selecting', async () => {
    const { onClose, onSelect } = setup()
    await screen.findByText(/Finance/)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows an inline error instead of crashing when a fetch fails', async () => {
    vi.mocked(ListDriveFolder).mockReset()
    vi.mocked(ListDriveFolder).mockRejectedValue(new Error('boom'))
    setup()

    expect(await screen.findByText(/boom/)).toBeTruthy()
    expect(screen.getByText(/My Drive/)).toBeTruthy()
  })
})
