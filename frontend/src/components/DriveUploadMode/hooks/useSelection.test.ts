import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSelection } from './useSelection'
import { LocalFileGroup } from '../types'

const TREE: LocalFileGroup = {
  name: '',
  files: [{ path: '/root/misc.pdf', name: 'misc', sizeBytes: 0, isPdf: true, pageCount: 1, corrupt: false }],
  subgroups: [],
}

const fileA = { type: 'file' as const, path: '/root/a.pdf' }
const fileB = { type: 'file' as const, path: '/root/b.pdf' }
const groupX = { type: 'group' as const, key: 'invoices' }

describe('useSelection', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useSelection(TREE))
    expect(result.current.size).toBe(0)
    expect(result.current.isSelected(fileA)).toBe(false)
  })

  it('replace sets the selection to just the given item, dropping any prior selection', () => {
    const { result } = renderHook(() => useSelection(TREE))
    act(() => result.current.replace(fileA))
    act(() => result.current.replace(groupX))

    expect(result.current.size).toBe(1)
    expect(result.current.isSelected(fileA)).toBe(false)
    expect(result.current.isSelected(groupX)).toBe(true)
  })

  it('toggle adds an item that is not yet selected without disturbing the rest', () => {
    const { result } = renderHook(() => useSelection(TREE))
    act(() => result.current.replace(fileA))
    act(() => result.current.toggle(fileB))
    act(() => result.current.toggle(groupX))

    expect(result.current.size).toBe(3)
    expect(result.current.isSelected(fileA)).toBe(true)
    expect(result.current.isSelected(fileB)).toBe(true)
    expect(result.current.isSelected(groupX)).toBe(true)
  })

  it('toggle removes an item that is already selected', () => {
    const { result } = renderHook(() => useSelection(TREE))
    act(() => result.current.toggle(fileA))
    act(() => result.current.toggle(fileB))
    act(() => result.current.toggle(fileA))

    expect(result.current.size).toBe(1)
    expect(result.current.isSelected(fileA)).toBe(false)
    expect(result.current.isSelected(fileB)).toBe(true)
  })

  it('a file and a group with the same key are distinct selection items', () => {
    const { result } = renderHook(() => useSelection(TREE))
    act(() => result.current.toggle({ type: 'file', path: 'x' }))

    expect(result.current.isSelected({ type: 'group', key: 'x' })).toBe(false)
    expect(result.current.size).toBe(1)
  })

  it('items lists the current selection', () => {
    const { result } = renderHook(() => useSelection(TREE))
    act(() => result.current.toggle(fileA))
    act(() => result.current.toggle(groupX))

    expect(result.current.items).toEqual(expect.arrayContaining([fileA, groupX]))
    expect(result.current.items.length).toBe(2)
  })

  it('resets to empty when the tree changes', () => {
    const { result, rerender } = renderHook(({ tree }) => useSelection(tree), { initialProps: { tree: TREE } })
    act(() => result.current.toggle(fileA))
    expect(result.current.size).toBe(1)

    const newTree: LocalFileGroup = { name: '', files: [], subgroups: [] }
    rerender({ tree: newTree })
    expect(result.current.size).toBe(0)
  })
})
