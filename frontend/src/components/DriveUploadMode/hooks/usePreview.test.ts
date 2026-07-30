import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePreview } from './usePreview'
import * as pageCache from '../../../lib/pageCache'

vi.mock('../../../lib/pageCache', () => ({
  evict: vi.fn(),
}))

function file(path: string) {
  return { path, name: path, sizeBytes: 0, isPdf: true, pageCount: 3, corrupt: false }
}

describe('usePreview', () => {
  it('starts with no file previewed', () => {
    const { result } = renderHook(() => usePreview())
    expect(result.current.file).toBeNull()
    expect(result.current.page).toBe(1)
  })

  it('setFile sets the file and resets the page to 1', () => {
    const { result } = renderHook(() => usePreview())
    act(() => result.current.setPage(4))

    act(() => result.current.setFile(file('/root/a.pdf')))

    expect(result.current.file).toEqual(file('/root/a.pdf'))
    expect(result.current.page).toBe(1)
  })

  it('evicts the previous file from the page cache when a different file is selected', () => {
    const { result } = renderHook(() => usePreview())
    act(() => result.current.setFile(file('/root/a.pdf')))

    act(() => result.current.setFile(file('/root/b.pdf')))

    expect(pageCache.evict).toHaveBeenCalledWith('/root/a.pdf')
  })

  it('does not evict when reselecting the same file', () => {
    const { result } = renderHook(() => usePreview())
    act(() => result.current.setFile(file('/root/a.pdf')))
    vi.mocked(pageCache.evict).mockClear()

    act(() => result.current.setFile(file('/root/a.pdf')))

    expect(pageCache.evict).not.toHaveBeenCalled()
  })

  it('evicts the last previewed file on unmount', () => {
    const { result, unmount } = renderHook(() => usePreview())
    act(() => result.current.setFile(file('/root/a.pdf')))

    unmount()

    expect(pageCache.evict).toHaveBeenCalledWith('/root/a.pdf')
  })
})
