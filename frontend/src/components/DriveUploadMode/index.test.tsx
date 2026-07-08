import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import DriveUploadMode from './index'
import { PickFolder, ScanLocalRoot, ListDriveFolder } from '../../../wailsjs/go/main/App'

vi.mock('../../../wailsjs/go/main/App', () => ({
  PickFolder: vi.fn(),
  ScanLocalRoot: vi.fn(),
  ListDriveFolder: vi.fn(),
  RenderPage: vi.fn().mockResolvedValue(''),
}))

const TREE = {
  name: '',
  files: [{ path: '/root/misc.pdf', name: 'misc', sizeBytes: 100, pageCount: 1, corrupt: false }],
  subgroups: [
    {
      name: 'invoices',
      files: [{ path: '/root/invoices/a.pdf', name: 'a', sizeBytes: 200, pageCount: 2, corrupt: false }],
      subgroups: [],
    },
  ],
}

const DRIVE_ROOT_ITEMS = [{ id: 'f1', name: 'Finance', isFolder: true, size: 0 }]

function textOf(el: HTMLElement) {
  return el.textContent ?? ''
}

async function setupWithTree() {
  vi.mocked(PickFolder).mockResolvedValueOnce('/root')
  vi.mocked(ScanLocalRoot).mockResolvedValueOnce(TREE as any)
  vi.mocked(ListDriveFolder).mockImplementation(async () => DRIVE_ROOT_ITEMS as any)

  render(
    <MantineProvider>
      <DriveUploadMode />
    </MantineProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Choose Root Folder' }))
  await screen.findByText(/invoices/)
}

describe('DriveUploadMode assignment fields', () => {
  beforeEach(() => {
    vi.mocked(PickFolder).mockReset()
    vi.mocked(ScanLocalRoot).mockReset()
    vi.mocked(ListDriveFolder).mockReset()
  })

  it('assigning a group folder propagates to its files until overridden', async () => {
    await setupWithTree()

    fireEvent.click(screen.getByRole('button', { name: 'Set Drive folder for invoices' }))
    fireEvent.click(await screen.findByRole('button', { name: '📁 Finance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select "Finance"' }))

    expect(textOf(await screen.findByRole('button', { name: 'Set Drive folder for invoices' })))
      .toContain('/Finance')
    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for a' })))
      .toContain('/Finance')

    fireEvent.click(screen.getByRole('button', { name: 'Set Drive folder for a' }))
    fireEvent.click(await screen.findByRole('button', { name: '📁 Finance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select "Finance"' }))

    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for a' }))).toContain('/Finance')
    expect(screen.getByRole('button', { name: 'Clear Drive folder for a' })).toBeTruthy()
  })

  it('clearing a group assignment falls its files back to not assigned', async () => {
    await setupWithTree()

    fireEvent.click(screen.getByRole('button', { name: 'Set Drive folder for invoices' }))
    fireEvent.click(await screen.findByRole('button', { name: '📁 Finance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select "Finance"' }))
    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for a' }))).toContain('/Finance')

    fireEvent.click(screen.getByRole('button', { name: 'Clear Drive folder for invoices' }))

    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for invoices' }))).toContain('Not assigned')
    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for a' }))).toContain('Not assigned')
  })

  it('a root-level loose file has no group to inherit from', async () => {
    await setupWithTree()
    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for misc' }))).toContain('Not assigned')
    expect(screen.queryByRole('button', { name: 'Clear Drive folder for misc' })).toBeNull()
  })
})

describe('DriveUploadMode file preview', () => {
  beforeEach(() => {
    vi.mocked(PickFolder).mockReset()
    vi.mocked(ScanLocalRoot).mockReset()
    vi.mocked(ListDriveFolder).mockReset()
  })

  it('selecting a file loads it into the thumbnail strip and detail panel', async () => {
    await setupWithTree()
    expect(screen.getByText('Select a file to preview')).toBeTruthy()

    fireEvent.click(screen.getByText('📄 a'))

    expect(screen.queryByText('Select a file to preview')).toBeNull()
    expect(await screen.findByAltText('Page 1')).toBeTruthy() // detail view
  })

  it('selecting a different file resets to its first page', async () => {
    await setupWithTree()

    fireEvent.click(screen.getByText('📄 a')) // file "a" has 2 pages
    await screen.findByAltText('Page 1')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await screen.findByAltText('Page 2')

    fireEvent.click(screen.getByText('📄 misc')) // "misc" only has 1 page
    expect(await screen.findByAltText('Page 1')).toBeTruthy()
    expect(screen.queryByAltText('Page 2')).toBeNull()
  })
})
