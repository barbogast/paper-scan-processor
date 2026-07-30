import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useUploadFlow } from './useUploadFlow'
import { useInclusion } from './useInclusion'
import { useDriveAssignments } from './useDriveAssignments'
import { LocalFileGroup } from '../types'
import * as uploadQueue from '../uploadQueue'
import { UploadFile, CancelUpload } from '../../../../wailsjs/go/main/App'

vi.mock('../../../../wailsjs/go/main/App', () => ({
  UploadFile: vi.fn(),
  CancelUpload: vi.fn(),
}))

function file(path: string) {
  return { path, name: path, sizeBytes: 0, isPdf: true, pageCount: 1, corrupt: false }
}

const TREE: LocalFileGroup = {
  name: '',
  key: null,
  files: [file('/root/misc.pdf')],
  subgroups: [
    { name: 'invoices', key: 'invoices', files: [file('/root/invoices/a.pdf')], subgroups: [] },
  ],
}

function setup(tree: LocalFileGroup | null) {
  return renderHook(() => {
    const inclusion = useInclusion(tree)
    const assignments = useDriveAssignments(tree)
    const flow = useUploadFlow(tree, inclusion, assignments)
    return { inclusion, assignments, flow }
  })
}

describe('useUploadFlow', () => {
  beforeEach(() => {
    vi.mocked(UploadFile).mockReset().mockResolvedValue('drive-id')
    vi.mocked(CancelUpload).mockReset().mockResolvedValue(undefined)
    uploadQueue.reset()
  })

  it('is not ready to upload without a tree, or before every file has a Drive folder', () => {
    expect(setup(null).result.current.flow.readyToUpload).toBe(false)
    expect(setup(TREE).result.current.flow.readyToUpload).toBe(false)
  })

  it('becomes ready once every file has an effective Drive assignment', () => {
    const { result } = setup(TREE)
    act(() => {
      result.current.assignments.setGroupAssignment('invoices', { driveFolderId: 'f1', path: '/Invoices' })
      result.current.assignments.setFileOverride('/root/misc.pdf', { driveFolderId: 'f2', path: '/Misc' })
    })
    expect(result.current.flow.readyToUpload).toBe(true)
  })

  it('ignores deselected files when checking readiness', () => {
    const { result } = setup(TREE)
    act(() => {
      result.current.inclusion.toggleFile('/root/misc.pdf')
      result.current.assignments.setGroupAssignment('invoices', { driveFolderId: 'f1', path: '/Invoices' })
    })
    expect(result.current.flow.readyToUpload).toBe(true)
  })

  it('startUpload enqueues every selected file with its effective assignment and locks the tree', async () => {
    const { result } = setup(TREE)
    act(() => {
      result.current.assignments.setGroupAssignment('invoices', { driveFolderId: 'f1', path: '/Invoices' })
      result.current.assignments.setFileOverride('/root/misc.pdf', { driveFolderId: 'f2', path: '/Misc' })
    })

    act(() => { result.current.flow.startUpload() })

    expect(result.current.flow.started).toBe(true)
    expect(result.current.flow.uploadModalOpen).toBe(true)

    // Concurrency is 1, so the second file's call only happens once the
    // first's mocked promise resolves — wait for both to settle before
    // checking the full call list.
    await waitFor(() => expect(uploadQueue.hasSettled(['/root/misc.pdf', '/root/invoices/a.pdf'])).toBe(true))
    expect(UploadFile).toHaveBeenCalledWith('/root/misc.pdf', 'f2', '/root/misc.pdf')
    expect(UploadFile).toHaveBeenCalledWith('/root/invoices/a.pdf', 'f1', '/root/invoices/a.pdf')
  })

  it('closeUploadModal closes the modal without unlocking the tree', () => {
    const { result } = setup(TREE)
    act(() => {
      result.current.assignments.setGroupAssignment('invoices', { driveFolderId: 'f1', path: '/Invoices' })
      result.current.assignments.setFileOverride('/root/misc.pdf', { driveFolderId: 'f2', path: '/Misc' })
    })
    act(() => { result.current.flow.startUpload() })

    act(() => { result.current.flow.closeUploadModal() })

    expect(result.current.flow.uploadModalOpen).toBe(false)
    expect(result.current.flow.started).toBe(true)
  })

  it('reset clears the upload queue and unlocks the tree', async () => {
    const { result } = setup(TREE)
    act(() => {
      result.current.assignments.setGroupAssignment('invoices', { driveFolderId: 'f1', path: '/Invoices' })
      result.current.assignments.setFileOverride('/root/misc.pdf', { driveFolderId: 'f2', path: '/Misc' })
    })
    act(() => { result.current.flow.startUpload() })
    await waitFor(() => expect(uploadQueue.hasSettled(['/root/misc.pdf', '/root/invoices/a.pdf'])).toBe(true))

    act(() => { result.current.flow.reset() })

    expect(result.current.flow.started).toBe(false)
    expect(uploadQueue.getStatus('/root/misc.pdf')).toBeUndefined()
  })
})
