import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useInclusion } from './useInclusion'
import { LocalFileGroup } from '../types'

function file(path: string) {
  return { path, name: path, sizeBytes: 0, isPdf: true, pageCount: 1, corrupt: false }
}

const TREE: LocalFileGroup = {
  name: '',
  files: [file('/root/misc.pdf')],
  subgroups: [
    {
      name: 'invoices',
      files: [file('/root/invoices/a.pdf'), file('/root/invoices/b.pdf')],
      subgroups: [
        { name: 'nested', files: [file('/root/invoices/nested/c.pdf')], subgroups: [] },
      ],
    },
    { name: 'receipts', files: [file('/root/receipts/d.pdf')], subgroups: [] },
  ],
}

const invoices = TREE.subgroups[0]
const nested = invoices.subgroups[0]
const receipts = TREE.subgroups[1]

describe('useInclusion', () => {
  it('starts with everything selected', () => {
    const { result } = renderHook(() => useInclusion(TREE))
    expect(result.current.isFileSelected('/root/misc.pdf')).toBe(true)
    expect(result.current.getGroupState(invoices)).toBe('checked')
    expect(result.current.getGroupState(TREE)).toBe('checked')
  })

  it('toggling a single file makes its ancestor groups indeterminate', () => {
    const { result } = renderHook(() => useInclusion(TREE))
    act(() => result.current.toggleFile('/root/invoices/nested/c.pdf'))

    expect(result.current.isFileSelected('/root/invoices/nested/c.pdf')).toBe(false)
    expect(result.current.getGroupState(nested)).toBe('unchecked')
    expect(result.current.getGroupState(invoices)).toBe('indeterminate')
    expect(result.current.getGroupState(TREE)).toBe('indeterminate')
    // An unrelated sibling group is unaffected.
    expect(result.current.getGroupState(receipts)).toBe('checked')
  })

  it('unchecking the last selected descendant collapses fully-unselected up to the root', () => {
    const { result } = renderHook(() => useInclusion(TREE))
    act(() => result.current.toggleFile('/root/invoices/a.pdf'))
    act(() => result.current.toggleFile('/root/invoices/b.pdf'))
    act(() => result.current.toggleFile('/root/invoices/nested/c.pdf'))

    expect(result.current.getGroupState(invoices)).toBe('unchecked')
    // The rest of the tree is still selected, so the root stays indeterminate.
    expect(result.current.getGroupState(TREE)).toBe('indeterminate')

    act(() => result.current.toggleFile('/root/misc.pdf'))
    act(() => result.current.toggleFile('/root/receipts/d.pdf'))
    expect(result.current.getGroupState(TREE)).toBe('unchecked')
  })

  it('checking the last unselected descendant collapses fully-selected up to the root', () => {
    const { result } = renderHook(() => useInclusion(TREE))
    act(() => result.current.selectNone())
    expect(result.current.getGroupState(TREE)).toBe('unchecked')

    act(() => result.current.toggleFile('/root/misc.pdf'))
    act(() => result.current.toggleFile('/root/invoices/a.pdf'))
    act(() => result.current.toggleFile('/root/invoices/b.pdf'))
    act(() => result.current.toggleFile('/root/receipts/d.pdf'))
    expect(result.current.getGroupState(TREE)).toBe('indeterminate')

    act(() => result.current.toggleFile('/root/invoices/nested/c.pdf'))
    expect(result.current.getGroupState(invoices)).toBe('checked')
    expect(result.current.getGroupState(TREE)).toBe('checked')
  })

  it('toggling a fully-selected group deselects all of its descendants', () => {
    const { result } = renderHook(() => useInclusion(TREE))
    act(() => result.current.toggleGroup(invoices))

    expect(result.current.isFileSelected('/root/invoices/a.pdf')).toBe(false)
    expect(result.current.isFileSelected('/root/invoices/b.pdf')).toBe(false)
    expect(result.current.isFileSelected('/root/invoices/nested/c.pdf')).toBe(false)
    expect(result.current.getGroupState(invoices)).toBe('unchecked')
    // Unrelated files stay selected.
    expect(result.current.isFileSelected('/root/misc.pdf')).toBe(true)
  })

  it('toggling an indeterminate group selects all of its descendants, never clears', () => {
    const { result } = renderHook(() => useInclusion(TREE))
    act(() => result.current.toggleFile('/root/invoices/nested/c.pdf'))
    expect(result.current.getGroupState(invoices)).toBe('indeterminate')

    act(() => result.current.toggleGroup(invoices))
    expect(result.current.getGroupState(invoices)).toBe('checked')
    expect(result.current.isFileSelected('/root/invoices/nested/c.pdf')).toBe(true)
  })

  it('selectAll and selectNone apply to the whole tree', () => {
    const { result } = renderHook(() => useInclusion(TREE))
    act(() => result.current.selectNone())
    expect(result.current.getGroupState(TREE)).toBe('unchecked')

    act(() => result.current.selectAll())
    expect(result.current.getGroupState(TREE)).toBe('checked')
  })

  it('resets to fully-selected when the tree changes', () => {
    const { result, rerender } = renderHook(({ tree }) => useInclusion(tree), { initialProps: { tree: TREE } })
    act(() => result.current.selectNone())
    expect(result.current.getGroupState(TREE)).toBe('unchecked')

    const newTree: LocalFileGroup = { name: '', files: [file('/other/x.pdf')], subgroups: [] }
    rerender({ tree: newTree })
    expect(result.current.isFileSelected('/other/x.pdf')).toBe(true)
  })
})
