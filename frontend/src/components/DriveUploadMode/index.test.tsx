import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import DriveUploadMode from './index'
import { PickFolder, ScanLocalRoot, ListDriveFolder, UploadFile } from '../../../wailsjs/go/main/App'
import * as uploadQueue from './uploadQueue'

vi.mock('../../../wailsjs/go/main/App', () => ({
  PickFolder: vi.fn(),
  ScanLocalRoot: vi.fn(),
  ListDriveFolder: vi.fn(),
  UploadFile: vi.fn(),
  RenderPage: vi.fn().mockResolvedValue(''),
}))

const TREE = {
  name: '',
  files: [
    { path: '/root/misc.pdf', name: 'misc', sizeBytes: 100, isPdf: true, pageCount: 1, corrupt: false },
    { path: '/root/scan.jpg', name: 'scan.jpg', sizeBytes: 50, isPdf: false, pageCount: 0, corrupt: false },
  ],
  subgroups: [
    {
      name: 'invoices',
      files: [{ path: '/root/invoices/a.pdf', name: 'a', sizeBytes: 200, isPdf: true, pageCount: 2, corrupt: false }],
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
  fireEvent.click(screen.getByRole('button', { name: 'Choose root folder…' }))
  await screen.findByText(/invoices/)
}

// Assigns the "Finance" Drive folder to the group/file whose badge is
// labelled `label` (i.e. the target of "Set Drive folder for {label}").
async function assign(label: string) {
  fireEvent.click(screen.getByRole('button', { name: `Set Drive folder for ${label}` }))
  fireEvent.click(await screen.findByRole('button', { name: '📁 Finance' }))
  fireEvent.click(screen.getByRole('button', { name: 'Select "Finance"' }))
}

// TREE has three files that each need their own assignment to resolve
// (misc.pdf and scan.jpg are root-level with no group to inherit from);
// assigning "invoices" covers a.pdf for all of them.
async function assignAllFolders() {
  await assign('invoices')
  await assign('misc')
  await assign('scan.jpg')
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

    fireEvent.click(screen.getByText('a'))

    expect(screen.queryByText('Select a file to preview')).toBeNull()
    expect(await screen.findByAltText('Page 1')).toBeTruthy() // detail view
  })

  it('a non-PDF file shows size only and cannot be previewed', async () => {
    await setupWithTree()

    const sizeText = screen.getByText(/50 B/)
    expect(textOf(sizeText)).not.toContain('pages')

    fireEvent.click(screen.getByText('📄 scan.jpg'))
    expect(screen.getByText('Select a file to preview')).toBeTruthy()
  })

  it('selecting a different file resets to its first page', async () => {
    await setupWithTree()

    fireEvent.click(screen.getByText('a')) // file "a" has 2 pages
    await screen.findByAltText('Page 1')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await screen.findByAltText('Page 2')

    fireEvent.click(screen.getByText('misc')) // "misc" only has 1 page
    expect(await screen.findByAltText('Page 1')).toBeTruthy()
    expect(screen.queryByAltText('Page 2')).toBeNull()
  })
})

describe('DriveUploadMode upload run', () => {
  beforeEach(() => {
    vi.mocked(PickFolder).mockReset()
    vi.mocked(ScanLocalRoot).mockReset()
    vi.mocked(ListDriveFolder).mockReset()
    vi.mocked(UploadFile).mockReset()
    uploadQueue.reset()
  })

  afterEach(() => {
    uploadQueue.reset()
  })

  function isDisabled(name: string) {
    return (screen.getByRole('button', { name }) as HTMLButtonElement).disabled
  }

  it('Upload All stays disabled until every file resolves to a Drive folder', async () => {
    await setupWithTree()
    expect(isDisabled('Upload All')).toBe(true)

    await assignAllFolders()

    expect(isDisabled('Upload All')).toBe(false)
  })

  it('clicking Upload All runs every file and shows terminal status in the modal', async () => {
    await setupWithTree()
    await assignAllFolders()
    vi.mocked(UploadFile).mockResolvedValue('drive-id')

    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))

    expect(await screen.findByText('Uploading to Drive')).toBeTruthy()

    await waitFor(() => expect(UploadFile).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(screen.getAllByText('✓ Uploaded').length).toBe(3))
    expect(isDisabled('Close')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('Uploading to Drive')).toBeNull())
  })

  it('a failed file shows an inline Retry that re-queues just that file', async () => {
    await setupWithTree()
    await assignAllFolders()
    vi.mocked(UploadFile).mockRejectedValueOnce(new Error('quota exceeded')).mockResolvedValue('drive-id')

    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))

    await waitFor(() => expect(screen.getByText(/quota exceeded/)).toBeTruthy())
    await waitFor(() => expect(screen.getAllByText('✓ Uploaded').length).toBe(2))
    expect(isDisabled('Close')).toBe(false) // run reached a terminal rest state, even with a failure showing

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getAllByText('✓ Uploaded').length).toBe(3))
    expect(screen.queryByText(/quota exceeded/)).toBeNull()
  })

  it('Cancel remaining reverts queued files without touching the one already in flight', async () => {
    await setupWithTree()
    await assignAllFolders()
    let resolveFirst: (v: string) => void = () => {}
    vi.mocked(UploadFile).mockImplementation(() => new Promise<string>(res => { resolveFirst = res }))

    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))
    await waitFor(() => expect(UploadFile).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Cancel remaining' }))
    expect(screen.getAllByText('Not uploaded').length).toBe(2)
    expect(isDisabled('Close')).toBe(true) // the in-flight file hasn't resolved yet

    resolveFirst('drive-id')
    await waitFor(() => expect(isDisabled('Close')).toBe(false))
  })
})
