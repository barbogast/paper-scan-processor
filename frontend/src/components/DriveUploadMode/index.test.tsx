import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import DriveUploadMode from './index'
import { PickFolder, ScanLocalRoot, ListDriveFolder, UploadFile } from '../../../wailsjs/go/main/App'
import * as uploadQueue from './uploadQueue'

vi.mock('../../../wailsjs/go/main/App', () => ({
  PickFolder: vi.fn(),
  ScanLocalRoot: vi.fn(),
  ListDriveFolder: vi.fn(),
  UploadFile: vi.fn(),
  CancelUpload: vi.fn().mockResolvedValue(undefined),
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

// Same shape/names as TREE (so assignAllFolders' labels still match) but
// under a different root, so its files are distinct paths from TREE's.
const TREE2 = {
  name: '',
  files: [
    { path: '/root2/misc.pdf', name: 'misc', sizeBytes: 100, isPdf: true, pageCount: 1, corrupt: false },
    { path: '/root2/scan.jpg', name: 'scan.jpg', sizeBytes: 50, isPdf: false, pageCount: 0, corrupt: false },
  ],
  subgroups: [
    {
      name: 'invoices',
      files: [{ path: '/root2/invoices/a.pdf', name: 'a', sizeBytes: 200, isPdf: true, pageCount: 2, corrupt: false }],
      subgroups: [],
    },
  ],
}

const DRIVE_ROOT_ITEMS = [{ id: 'f1', name: 'Finance', isFolder: true, size: 0 }]

function textOf(el: HTMLElement) {
  return el.textContent ?? ''
}

// A previewed file's name is duplicated once it also appears as the detail
// panel heading, so pick out whichever match sits inside the tree — the
// heading has no aria-selected ancestor at all, since it lives in the
// separate preview column.
function ariaSelected(text: string) {
  const row = screen.getAllByText(text).find(el => el.closest('[aria-selected]'))
  return row!.closest('[aria-selected]')!.getAttribute('aria-selected')
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

  it('shows the previewed file\'s name as a heading above the detail panel', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('a'))
    await screen.findByAltText('Page 1')

    // "a" now appears twice: once in the tree, once as the heading.
    expect(screen.getAllByText('a').length).toBe(2)
  })

  it('clicking a subfolder leaves the preview showing whatever was last previewed', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('misc'))
    await screen.findByAltText('Page 1')

    fireEvent.click(screen.getByText('📁 invoices'))

    expect(screen.getByAltText('Page 1')).toBeTruthy()
    expect(screen.getAllByText('misc').length).toBe(2) // tree row + heading, unchanged
  })

  it('clicking a non-previewable file leaves the preview showing whatever was last previewed', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('a'))
    await screen.findByAltText('Page 1')

    fireEvent.click(screen.getByText('📄 scan.jpg'))

    expect(screen.queryByText('Select a file to preview')).toBeNull()
    expect(screen.getByAltText('Page 1')).toBeTruthy()
  })

  it('Cmd/Ctrl-clicking the previewed file out of the selection still previews it', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('a'))
    fireEvent.click(screen.getByText('misc'), { metaKey: true }) // adds misc, preview follows to misc

    expect(screen.getAllByText('misc').length).toBe(2) // misc is previewed
    expect(screen.getAllByText('a').length).toBe(1) // a is not

    fireEvent.click(screen.getByText('a'), { metaKey: true }) // removes a from the selection

    expect(ariaSelected('a')).toBe('false')
    expect(screen.getAllByText('a').length).toBe(2) // preview follows the click regardless
    expect(screen.getAllByText('misc').length).toBe(1)
  })
})

describe('DriveUploadMode multi-selection', () => {
  beforeEach(() => {
    vi.mocked(PickFolder).mockReset()
    vi.mocked(ScanLocalRoot).mockReset()
    vi.mocked(ListDriveFolder).mockReset()
  })


  it('plain click selects only the clicked file, replacing any prior selection', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('a'))
    expect(ariaSelected('a')).toBe('true')

    fireEvent.click(screen.getByText('misc'))
    expect(ariaSelected('misc')).toBe('true')
    expect(ariaSelected('a')).toBe('false')
  })

  it('Cmd/Ctrl-click adds a file to the existing selection instead of replacing it', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('a'))
    fireEvent.click(screen.getByText('misc'), { metaKey: true })

    expect(ariaSelected('a')).toBe('true')
    expect(ariaSelected('misc')).toBe('true')
  })

  it('Cmd/Ctrl-click on an already-selected file removes just that file', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('a'))
    fireEvent.click(screen.getByText('misc'), { metaKey: true })
    fireEvent.click(screen.getByText('a'), { metaKey: true })

    expect(ariaSelected('a')).toBe('false')
    expect(ariaSelected('misc')).toBe('true')
  })

  it('clicking a checkbox or Drive badge does not disturb the selection', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('a'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include misc in upload' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set Drive folder for misc' }))

    expect(ariaSelected('a')).toBe('true')
  })

  it('clicking the chevron toggles expand/collapse without touching the selection', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('a'))
    expect(ariaSelected('a')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Collapse invoices' }))
    // The row is gone from the collapsed tree, but the file stays previewed
    // (its heading persists) — collapsing isn't a preview- or selection-
    // clearing action.
    expect(screen.queryByRole('button', { name: 'Set Drive folder for a' })).toBeNull()
    expect(screen.getByText('a')).toBeTruthy() // still shown, now only as the heading

    fireEvent.click(screen.getByRole('button', { name: 'Expand invoices' }))
    expect(ariaSelected('a')).toBe('true')
  })

  it('a plain click on a subfolder name selects it and, as a convenience, toggles expand/collapse when the selection held at most one item', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('📁 invoices'))

    expect(ariaSelected('📁 invoices')).toBe('true')
    expect(screen.queryByText('a')).toBeNull() // convenience collapse fired
  })

  it('does not pop a subfolder open/closed from a plain click once two or more items are selected', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('misc'))
    fireEvent.click(screen.getByText('📄 scan.jpg'), { metaKey: true })

    fireEvent.click(screen.getByText('📁 invoices'))

    expect(ariaSelected('📁 invoices')).toBe('true')
    expect(ariaSelected('misc')).toBe('false') // selection replaced
    expect(screen.getByText('a')).toBeTruthy() // still expanded — convenience suppressed
  })

  it('Cmd/Ctrl-click on a subfolder name toggles it into the selection without affecting expand/collapse', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('misc'))
    fireEvent.click(screen.getByText('📁 invoices'), { metaKey: true })

    expect(ariaSelected('misc')).toBe('true')
    expect(ariaSelected('📁 invoices')).toBe('true')
    expect(screen.getByText('a')).toBeTruthy() // unaffected, still expanded
  })
})

describe('DriveUploadMode batch Drive folder assignment', () => {
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

  async function batchAssign() {
    fireEvent.click(screen.getByRole('button', { name: 'Assign Drive folder…' }))
    fireEvent.click(await screen.findByRole('button', { name: '📁 Finance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select "Finance"' }))
  }

  it('is disabled until the selection is non-empty', async () => {
    await setupWithTree()
    expect(isDisabled('Assign Drive folder…')).toBe(true)

    fireEvent.click(screen.getByText('misc'))
    expect(isDisabled('Assign Drive folder…')).toBe(false)
  })

  it('applies the picked folder to every selected file', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('misc'))
    fireEvent.click(screen.getByText('a'), { metaKey: true })

    await batchAssign()

    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for misc' }))).toContain('/Finance')
    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for a' }))).toContain('/Finance')
    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for scan.jpg' }))).toContain('Not assigned')
  })

  it('applies a group assignment when a subfolder is selected, which its files inherit', async () => {
    await setupWithTree()
    // Cmd/Ctrl-click, so selecting the group doesn't also collapse it via
    // the plain-click expand/collapse convenience (unrelated to this test).
    fireEvent.click(screen.getByText('📁 invoices'), { metaKey: true })

    await batchAssign()

    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for invoices' }))).toContain('/Finance')
    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for a' }))).toContain('/Finance')
    // "a" inherits rather than getting its own override.
    expect(screen.queryByRole('button', { name: 'Clear Drive folder for a' })).toBeNull()
  })

  it('prunes a selected descendant of a selected subfolder, applying only to the ancestor', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('📁 invoices'), { metaKey: true })
    fireEvent.click(screen.getByText('a'), { metaKey: true })

    await batchAssign()

    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for invoices' }))).toContain('/Finance')
    // "a" still inherits — it didn't get its own redundant override.
    expect(screen.queryByRole('button', { name: 'Clear Drive folder for a' })).toBeNull()
  })

  it('per-row badge clicks stay single-target regardless of the multi-selection', async () => {
    await setupWithTree()
    fireEvent.click(screen.getByText('misc'))
    fireEvent.click(screen.getByText('a'), { metaKey: true })

    await assign('misc') // per-row badge, not the toolbar batch action

    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for misc' }))).toContain('/Finance')
    expect(textOf(screen.getByRole('button', { name: 'Set Drive folder for a' }))).toContain('Not assigned')
  })

  it('is disabled once the tree locks', async () => {
    await setupWithTree()
    await assignAllFolders()
    fireEvent.click(screen.getByText('misc'))
    vi.mocked(UploadFile).mockResolvedValue('drive-id')

    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))
    expect(isDisabled('Assign Drive folder…')).toBe(true)

    await waitFor(() => expect(screen.getAllByText('✓ Uploaded').length).toBe(3))
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

  it('Cancel aborts the in-flight upload and pauses everything still queued', async () => {
    await setupWithTree()
    await assignAllFolders()
    let resolveFirst: (v: string) => void = () => {}
    vi.mocked(UploadFile).mockImplementation(() => new Promise<string>(res => { resolveFirst = res }))

    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))
    await waitFor(() => expect(UploadFile).toHaveBeenCalledTimes(1))

    const closeButton = screen.getByRole('button', { name: 'Close' })
    const uploadDialog = closeButton.closest('[role="dialog"]') as HTMLElement
    fireEvent.click(within(uploadDialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getAllByText('Not uploaded').length).toBe(2)
    expect(screen.getByText('Cancelled')).toBeTruthy()
    expect(isDisabled('Close')).toBe(false) // cancelAll marks the in-flight file 'cancelled' immediately, without waiting for it to resolve

    resolveFirst('drive-id')
    await waitFor(() => expect(isDisabled('Close')).toBe(false))
  })

  it('locks the tree the moment Upload All is clicked: badges become Drive links and lose their clear control', async () => {
    await setupWithTree()
    await assignAllFolders()
    vi.mocked(UploadFile).mockRejectedValueOnce(new Error('quota exceeded')).mockResolvedValue('drive-id')

    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))

    // Locked immediately — the destination is already fixed the moment the
    // run starts, so every badge is a Drive link from the outset, not just
    // ones whose file has actually finished uploading yet.
    expect(isDisabled('Upload All')).toBe(true)
    expect(screen.getByRole('button', { name: 'Open Drive folder for misc' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Set Drive folder for misc' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear Drive folder for misc' })).toBeNull()

    await waitFor(() => expect(screen.getByText(/quota exceeded/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    // Still locked after close, failure and all — retrying happens inside
    // the modal, not from the main tree.
    expect(isDisabled('Upload All')).toBe(true)
    expect(screen.getByRole('button', { name: 'Open Drive folder for misc' })).toBeTruthy()
  })

  it('picking a new root unlocks the tree for the new run', async () => {
    await setupWithTree()
    await assignAllFolders()
    vi.mocked(UploadFile).mockResolvedValue('drive-id')

    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))
    await waitFor(() => expect(screen.getAllByText('✓ Uploaded').length).toBe(3))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(isDisabled('Upload All')).toBe(true)

    vi.mocked(PickFolder).mockResolvedValueOnce('/root2')
    vi.mocked(ScanLocalRoot).mockResolvedValueOnce(TREE2 as any)
    fireEvent.click(screen.getByRole('button', { name: '…/root' }))
    await screen.findByRole('button', { name: '…/root2' })

    // The new tree's files are unassigned and unlocked, even though misc.pdf
    // was 'done' under the old root.
    expect(isDisabled('Upload All')).toBe(true)
    expect(screen.getByRole('button', { name: 'Set Drive folder for misc' })).toBeTruthy()

    await assignAllFolders()
    expect(isDisabled('Upload All')).toBe(false)
  })

  it('a group-level assignment and a collapsed group do not survive a root switch, even when the new root has a same-named subfolder', async () => {
    await setupWithTree()
    await assign('invoices')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse invoices' }))
    expect(screen.getByRole('button', { name: 'Clear Drive folder for invoices' })).toBeTruthy()

    vi.mocked(PickFolder).mockResolvedValueOnce('/root2')
    vi.mocked(ScanLocalRoot).mockResolvedValueOnce(TREE2 as any)
    fireEvent.click(screen.getByRole('button', { name: '…/root' }))
    await screen.findByRole('button', { name: '…/root2' })

    // TREE2's "invoices" subfolder is unrelated to TREE's, despite sharing a
    // name/key — it should come in unassigned and expanded (the default),
    // not inheriting the old root's assignment or collapsed state.
    expect(screen.queryByRole('button', { name: 'Clear Drive folder for invoices' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Collapse invoices' })).toBeTruthy()
  })
})

describe('DriveUploadMode inclusion selection', () => {
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

  function checkbox(name: string) {
    return screen.getByRole('checkbox', { name }) as HTMLInputElement
  }

  it('excluding a file drops it from the Drive-folder requirement and the upload run', async () => {
    await setupWithTree()
    await assign('invoices')
    await assign('misc')
    expect(isDisabled('Upload All')).toBe(true) // scan.jpg still unassigned

    fireEvent.click(checkbox('Include scan.jpg in upload'))
    expect(isDisabled('Upload All')).toBe(false)

    vi.mocked(UploadFile).mockResolvedValue('drive-id')
    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))
    await waitFor(() => expect(UploadFile).toHaveBeenCalledTimes(2))
    expect(UploadFile).not.toHaveBeenCalledWith('/root/scan.jpg', expect.anything(), expect.anything())
  })

  it('unchecking a group excludes all of its files', async () => {
    await setupWithTree()
    fireEvent.click(checkbox('Include invoices in upload'))

    expect(checkbox('Include a in upload').checked).toBe(false)
  })

  it('Select None disables Upload All; Select All restores the assignment requirement', async () => {
    await setupWithTree()
    await assignAllFolders()
    expect(isDisabled('Upload All')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Select None' }))
    expect(isDisabled('Upload All')).toBe(true)
    expect(checkbox('Include misc in upload').checked).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }))
    expect(isDisabled('Upload All')).toBe(false)
    expect(checkbox('Include misc in upload').checked).toBe(true)
  })

  it('checkboxes lock once the tree locks', async () => {
    await setupWithTree()
    await assignAllFolders()
    vi.mocked(UploadFile).mockResolvedValue('drive-id')

    fireEvent.click(screen.getByRole('button', { name: 'Upload All' }))

    expect(checkbox('Include misc in upload').disabled).toBe(true)
    expect(checkbox('Include invoices in upload').disabled).toBe(true)
    expect(isDisabled('Select All')).toBe(true)
    expect(isDisabled('Select None')).toBe(true)

    await waitFor(() => expect(screen.getAllByText('✓ Uploaded').length).toBe(3))
  })
})
