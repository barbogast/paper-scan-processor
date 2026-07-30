import { describe, it, expect } from 'vitest'
import { resolveEffectiveAssignments } from './useDriveAssignments'
import { LocalFileGroup, DriveAssignment } from '../types'

function file(path: string) {
  return { path, name: path, sizeBytes: 0, isPdf: true, pageCount: 1, corrupt: false }
}

function folder(path: string): DriveAssignment {
  return { driveFolderId: path, path }
}

const TREE: LocalFileGroup = {
  name: '',
  key: null,
  files: [file('/root/misc.pdf')],
  subgroups: [
    {
      name: 'invoices',
      key: 'invoices',
      files: [file('/root/invoices/a.pdf')],
      subgroups: [
        { name: 'nested', key: 'invoices/nested', files: [file('/root/invoices/nested/b.pdf')], subgroups: [] },
      ],
    },
  ],
}

describe('resolveEffectiveAssignments', () => {
  it('resolves nothing when no assignments have been made', () => {
    const result = resolveEffectiveAssignments(TREE, { groupAssignments: new Map(), fileOverrides: new Map() })
    expect(result.get('/root/misc.pdf')).toBeNull()
    expect(result.get('/root/invoices/a.pdf')).toBeNull()
    expect(result.get('/root/invoices/nested/b.pdf')).toBeNull()
  })

  it('a root-level file has no group to inherit from', () => {
    const groupAssignments = new Map([['invoices', folder('/Finance')]])
    const result = resolveEffectiveAssignments(TREE, { groupAssignments, fileOverrides: new Map() })
    expect(result.get('/root/misc.pdf')).toBeNull()
  })

  it('a group assignment is inherited by its files and nested subgroups', () => {
    const groupAssignments = new Map([['invoices', folder('/Finance')]])
    const result = resolveEffectiveAssignments(TREE, { groupAssignments, fileOverrides: new Map() })
    expect(result.get('/root/invoices/a.pdf')).toEqual(folder('/Finance'))
    expect(result.get('/root/invoices/nested/b.pdf')).toEqual(folder('/Finance'))
  })

  it('a nested subgroup assignment overrides the ancestor group for its own files', () => {
    const groupAssignments = new Map([
      ['invoices', folder('/Finance')],
      ['invoices/nested', folder('/Finance/Nested')],
    ])
    const result = resolveEffectiveAssignments(TREE, { groupAssignments, fileOverrides: new Map() })
    expect(result.get('/root/invoices/a.pdf')).toEqual(folder('/Finance'))
    expect(result.get('/root/invoices/nested/b.pdf')).toEqual(folder('/Finance/Nested'))
  })

  it('a file override wins over its group assignment', () => {
    const groupAssignments = new Map([['invoices', folder('/Finance')]])
    const fileOverrides = new Map([['/root/invoices/a.pdf', folder('/Special')]])
    const result = resolveEffectiveAssignments(TREE, { groupAssignments, fileOverrides })
    expect(result.get('/root/invoices/a.pdf')).toEqual(folder('/Special'))
    expect(result.get('/root/invoices/nested/b.pdf')).toEqual(folder('/Finance'))
  })
})
