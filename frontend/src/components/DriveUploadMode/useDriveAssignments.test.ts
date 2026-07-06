import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDriveAssignments } from './useDriveAssignments'

const FINANCE = { driveFolderId: 'f1', path: 'My Drive / Finance' }
const INVOICES = { driveFolderId: 'f2', path: 'My Drive / Finance / Invoices' }

describe('useDriveAssignments', () => {
  it('starts with no assignments or overrides', () => {
    const { result } = renderHook(() => useDriveAssignments())
    expect(result.current.groupAssignments.size).toBe(0)
    expect(result.current.fileOverrides.size).toBe(0)
  })

  it('sets and clears a group assignment independently of other groups', () => {
    const { result } = renderHook(() => useDriveAssignments())
    act(() => { result.current.setGroupAssignment('invoices', FINANCE) })
    act(() => { result.current.setGroupAssignment('invoices/2026', INVOICES) })

    expect(result.current.groupAssignments.get('invoices')).toEqual(FINANCE)
    expect(result.current.groupAssignments.get('invoices/2026')).toEqual(INVOICES)

    act(() => { result.current.clearGroupAssignment('invoices') })
    expect(result.current.groupAssignments.get('invoices')).toBeUndefined()
    expect(result.current.groupAssignments.get('invoices/2026')).toEqual(INVOICES)
  })

  it('sets and clears a file override independently of other files', () => {
    const { result } = renderHook(() => useDriveAssignments())
    act(() => { result.current.setFileOverride('/root/a.pdf', FINANCE) })
    act(() => { result.current.setFileOverride('/root/b.pdf', INVOICES) })

    expect(result.current.fileOverrides.get('/root/a.pdf')).toEqual(FINANCE)
    expect(result.current.fileOverrides.get('/root/b.pdf')).toEqual(INVOICES)

    act(() => { result.current.clearFileOverride('/root/a.pdf') })
    expect(result.current.fileOverrides.get('/root/a.pdf')).toBeUndefined()
    expect(result.current.fileOverrides.get('/root/b.pdf')).toEqual(INVOICES)
  })

  it('keeps group assignments and file overrides in separate namespaces', () => {
    const { result } = renderHook(() => useDriveAssignments())
    act(() => { result.current.setGroupAssignment('shared-key', FINANCE) })
    act(() => { result.current.setFileOverride('shared-key', INVOICES) })

    expect(result.current.groupAssignments.get('shared-key')).toEqual(FINANCE)
    expect(result.current.fileOverrides.get('shared-key')).toEqual(INVOICES)
  })

  it('overwrites an existing assignment when set again', () => {
    const { result } = renderHook(() => useDriveAssignments())
    act(() => { result.current.setGroupAssignment('invoices', FINANCE) })
    act(() => { result.current.setGroupAssignment('invoices', INVOICES) })
    expect(result.current.groupAssignments.get('invoices')).toEqual(INVOICES)
  })
})
