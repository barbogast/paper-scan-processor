import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDrivePicker } from './useDrivePicker'
import { useSelection } from './useSelection'
import { useDriveAssignments } from './useDriveAssignments'
import { LocalFileGroup, DriveAssignment } from '../types'

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

function folder(path: string): DriveAssignment {
  return { driveFolderId: path, path }
}

function setup(tree: LocalFileGroup | null) {
  return renderHook(() => {
    const selection = useSelection(tree)
    const assignments = useDriveAssignments(tree)
    const picker = useDrivePicker(tree, selection, assignments)
    return { selection, assignments, picker }
  })
}

describe('useDrivePicker', () => {
  it('starts closed', () => {
    const { result } = setup(TREE)
    expect(result.current.picker.opened).toBe(false)
  })

  it('pickOne opens the picker for a single target', () => {
    const { result } = setup(TREE)
    act(() => result.current.picker.pickOne({ type: 'file', path: '/root/misc.pdf' }))
    expect(result.current.picker.opened).toBe(true)
  })

  it('pickSelection opens the picker for the pruned current selection', () => {
    const { result } = setup(TREE)
    act(() => {
      result.current.selection.replace({ type: 'group', key: 'invoices' })
      result.current.selection.toggle({ type: 'file', path: '/root/invoices/a.pdf' })
    })

    act(() => result.current.picker.pickSelection())

    // The file is a descendant of the selected group, so it's pruned from
    // the picker targets — the group alone gets the assignment.
    expect(result.current.picker.opened).toBe(true)
    act(() => result.current.picker.apply(folder('/Invoices')))
    expect(result.current.assignments.groupAssignments.get('invoices')).toEqual(folder('/Invoices'))
    expect(result.current.assignments.fileOverrides.size).toBe(0)
  })

  it('pickSelection does nothing without a tree', () => {
    const { result } = setup(null)
    act(() => result.current.picker.pickSelection())
    expect(result.current.picker.opened).toBe(false)
  })

  it('apply assigns the folder to every current target and closes the picker', () => {
    const { result } = setup(TREE)
    act(() => result.current.picker.pickOne({ type: 'file', path: '/root/misc.pdf' }))

    act(() => result.current.picker.apply(folder('/Misc')))

    expect(result.current.assignments.fileOverrides.get('/root/misc.pdf')).toEqual(folder('/Misc'))
    expect(result.current.picker.opened).toBe(false)
  })

  it('close dismisses the picker without assigning anything', () => {
    const { result } = setup(TREE)
    act(() => result.current.picker.pickOne({ type: 'file', path: '/root/misc.pdf' }))

    act(() => result.current.picker.close())

    expect(result.current.picker.opened).toBe(false)
    expect(result.current.assignments.fileOverrides.size).toBe(0)
  })
})
