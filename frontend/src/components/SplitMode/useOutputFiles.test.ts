import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useOutputFiles } from './useOutputFiles'
import { PickFolder } from '../../../wailsjs/go/main/App'

vi.mock('../../../wailsjs/go/main/App', () => ({
  PickFolder: vi.fn(),
}))

describe('useOutputFiles', () => {
  it('starts with a single output file at position 0', () => {
    const { result } = renderHook(() => useOutputFiles(null))
    expect([...result.current.all.keys()]).toEqual([0])
    expect(result.current.getSplitPoints()).toEqual(new Set())
  })

  it('toggle adds a split point after the given position', () => {
    const { result } = renderHook(() => useOutputFiles(null))
    act(() => {
      const added = result.current.toggle(2, 'second')
      expect(added).toBe(true)
    })
    expect([...result.current.all.keys()].sort((a, b) => a - b)).toEqual([0, 3])
    expect(result.current.getSplitPoints()).toEqual(new Set([2]))
  })

  it('toggle removes an existing split point', () => {
    const { result } = renderHook(() => useOutputFiles(null))
    act(() => { result.current.toggle(2, 'second') })
    act(() => {
      const added = result.current.toggle(2, 'second')
      expect(added).toBe(false)
    })
    expect([...result.current.all.keys()]).toEqual([0])
    expect(result.current.getSplitPoints()).toEqual(new Set())
  })

  it('flags files with the same name and folder as duplicates', () => {
    const { result } = renderHook(() => useOutputFiles('/out'))
    act(() => { result.current.toggle(2, 'invoice') })
    act(() => { result.current.setName(0, 'invoice') })
    expect(result.current.duplicateFirstPages).toEqual(new Set([0, 3]))
  })

  it('does not flag same-name files in different folders as duplicates', async () => {
    vi.mocked(PickFolder).mockResolvedValueOnce('/elsewhere')
    const { result } = renderHook(() => useOutputFiles('/out'))
    act(() => { result.current.toggle(2, 'invoice') })
    act(() => { result.current.setName(0, 'invoice') })
    expect(result.current.duplicateFirstPages).toEqual(new Set([0, 3]))

    await act(async () => { await result.current.pickFolderOverride(3) })
    expect(result.current.duplicateFirstPages).toEqual(new Set())
  })

  it('reset replaces all output files with a single entry at position 0', () => {
    const { result } = renderHook(() => useOutputFiles(null))
    act(() => { result.current.toggle(2, 'second') })
    act(() => { result.current.reset('first') })
    expect([...result.current.all.entries()]).toEqual([[0, { name: 'first' }]])
    expect(result.current.getSplitPoints()).toEqual(new Set())
  })
})
