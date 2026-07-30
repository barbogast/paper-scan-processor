import { describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useFileTree, flattenFiles } from './useFileTree'
import { LocalFileGroup } from './types'
import { PickFolder, ScanLocalRoot } from '../../../wailsjs/go/main/App'

vi.mock('../../../wailsjs/go/main/App', () => ({
  PickFolder: vi.fn(),
  ScanLocalRoot: vi.fn(),
}))

function file(path: string) {
  return { path, name: path, sizeBytes: 0, isPdf: true, pageCount: 1, corrupt: false }
}

describe('flattenFiles', () => {
  it("lists a group's own files before its subgroups, recursively", () => {
    const tree: LocalFileGroup = {
      name: '',
      files: [file('/root/misc.pdf')],
      subgroups: [
        {
          name: 'invoices',
          files: [file('/root/invoices/a.pdf')],
          subgroups: [
            { name: 'nested', files: [file('/root/invoices/nested/c.pdf')], subgroups: [] },
          ],
        },
        { name: 'receipts', files: [file('/root/receipts/b.pdf')], subgroups: [] },
      ],
    }

    expect(flattenFiles(tree).map(f => f.path)).toEqual([
      '/root/misc.pdf',
      '/root/invoices/a.pdf',
      '/root/invoices/nested/c.pdf',
      '/root/receipts/b.pdf',
    ])
  })
})

describe('useFileTree', () => {
  it('starts with no root and no tree', () => {
    const { result } = renderHook(() => useFileTree())
    expect(result.current.root).toBeNull()
    expect(result.current.tree).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('does nothing when the folder picker is cancelled', async () => {
    vi.mocked(PickFolder).mockResolvedValueOnce('')
    const { result } = renderHook(() => useFileTree())
    await act(async () => { await result.current.pickRoot() })
    expect(result.current.root).toBeNull()
    expect(ScanLocalRoot).not.toHaveBeenCalled()
  })

  it('scans the chosen root and stores the resulting tree', async () => {
    vi.mocked(PickFolder).mockResolvedValueOnce('/output/batch')
    const tree = {
      name: '',
      files: [],
      subgroups: [{ name: 'invoices', files: [{ path: '/output/batch/invoices/a.pdf', name: 'a', sizeBytes: 100, pageCount: 2, corrupt: false }], subgroups: [] }],
    }
    vi.mocked(ScanLocalRoot).mockResolvedValueOnce(tree as any)

    const { result } = renderHook(() => useFileTree())
    await act(async () => { await result.current.pickRoot() })

    expect(result.current.root).toBe('/output/batch')
    expect(result.current.tree).toEqual(tree)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets an error and clears the tree when the scan fails', async () => {
    vi.mocked(PickFolder).mockResolvedValueOnce('/output/batch')
    vi.mocked(ScanLocalRoot).mockRejectedValueOnce(new Error('permission denied'))

    const { result } = renderHook(() => useFileTree())
    await act(async () => { await result.current.pickRoot() })

    await waitFor(() => expect(result.current.error).toContain('permission denied'))
    expect(result.current.tree).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
