import { describe, it, expect } from 'vitest'
import { pruneSelectionForAssignment } from './pruneSelection'
import { LocalFileGroup } from './types'

function file(path: string) {
  return { path, name: path, sizeBytes: 0, isPdf: true, pageCount: 1, corrupt: false }
}

const TREE: LocalFileGroup = {
  name: '',
  key: null,
  files: [file('/root/misc.pdf')],
  subgroups: [
    {
      name: 'invoices',
      key: 'invoices',
      files: [file('/root/invoices/a.pdf'), file('/root/invoices/b.pdf')],
      subgroups: [
        { name: 'nested', key: 'invoices/nested', files: [file('/root/invoices/nested/c.pdf')], subgroups: [] },
      ],
    },
    { name: 'receipts', key: 'receipts', files: [file('/root/receipts/d.pdf')], subgroups: [] },
  ],
}

describe('pruneSelectionForAssignment', () => {
  it('keeps a selection with no ancestor/descendant relationships untouched', () => {
    const items = [
      { type: 'file' as const, path: '/root/misc.pdf' },
      { type: 'group' as const, key: 'receipts' },
    ]
    expect(pruneSelectionForAssignment(TREE, items)).toEqual(expect.arrayContaining(items))
    expect(pruneSelectionForAssignment(TREE, items).length).toBe(2)
  })

  it('drops a file that is a descendant of a selected group', () => {
    const items = [
      { type: 'group' as const, key: 'invoices' },
      { type: 'file' as const, path: '/root/invoices/a.pdf' },
    ]
    expect(pruneSelectionForAssignment(TREE, items)).toEqual([{ type: 'group', key: 'invoices' }])
  })

  it('drops a subgroup that is a descendant of a selected ancestor group', () => {
    const items = [
      { type: 'group' as const, key: 'invoices' },
      { type: 'group' as const, key: 'invoices/nested' },
    ]
    expect(pruneSelectionForAssignment(TREE, items)).toEqual([{ type: 'group', key: 'invoices' }])
  })

  it('drops a file nested two levels below a selected ancestor group', () => {
    const items = [
      { type: 'group' as const, key: 'invoices' },
      { type: 'file' as const, path: '/root/invoices/nested/c.pdf' },
    ]
    expect(pruneSelectionForAssignment(TREE, items)).toEqual([{ type: 'group', key: 'invoices' }])
  })

  it('keeps a file selected alongside its sibling group, since it is not that group\'s descendant', () => {
    const items = [
      { type: 'group' as const, key: 'invoices' },
      { type: 'file' as const, path: '/root/receipts/d.pdf' },
    ]
    expect(pruneSelectionForAssignment(TREE, items)).toEqual(expect.arrayContaining(items))
    expect(pruneSelectionForAssignment(TREE, items).length).toBe(2)
  })

  it('a root-level file has no ancestor group and is never pruned', () => {
    const items = [
      { type: 'group' as const, key: 'invoices' },
      { type: 'file' as const, path: '/root/misc.pdf' },
    ]
    expect(pruneSelectionForAssignment(TREE, items)).toEqual(expect.arrayContaining(items))
    expect(pruneSelectionForAssignment(TREE, items).length).toBe(2)
  })
})
