import { useState, useCallback, useEffect } from 'react'
import { flattenFiles } from './useFileTree'
import { LocalFileGroup } from './types'

export type GroupSelectionState = 'checked' | 'unchecked' | 'indeterminate'

export interface InclusionHandle {
  isFileSelected: (path: string) => boolean
  getGroupState: (group: LocalFileGroup) => GroupSelectionState
  toggleFile: (path: string) => void
  toggleGroup: (group: LocalFileGroup) => void
  selectAll: () => void
  selectNone: () => void
}

// Tracks which files are excluded from the upload, keyed by path. A
// subfolder's checkbox state is derived from its descendant files rather
// than stored separately, so the "fully selected/unselected collapses all
// the way up the tree" behavior falls out of the derivation for free
// instead of needing explicit upward-propagation bookkeeping.
export function useInclusion(tree: LocalFileGroup | null): InclusionHandle {
  const [deselected, setDeselected] = useState<Set<string>>(new Set())

  // Resets to fully-selected on every fresh scan — deliberately not
  // persisted, unlike Drive folder mappings.
  useEffect(() => {
    setDeselected(new Set())
  }, [tree])

  const isFileSelected = useCallback((path: string) => !deselected.has(path), [deselected])

  const getGroupState = useCallback((group: LocalFileGroup): GroupSelectionState => {
    const files = flattenFiles(group)
    if (files.length === 0) return 'checked'
    const selectedCount = files.filter(f => !deselected.has(f.path)).length
    if (selectedCount === 0) return 'unchecked'
    if (selectedCount === files.length) return 'checked'
    return 'indeterminate'
  }, [deselected])

  const toggleFile = useCallback((path: string) => {
    setDeselected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }, [])

  // Indeterminate or fully-unselected groups select all descendants; a
  // fully-selected group deselects all descendants. Decided from the
  // group's own current state rather than the checkbox's native toggle, so
  // clicking an indeterminate checkbox always selects, never clears.
  const toggleGroup = useCallback((group: LocalFileGroup) => {
    const files = flattenFiles(group)
    setDeselected(prev => {
      const allSelected = files.every(f => !prev.has(f.path))
      const next = new Set(prev)
      for (const f of files) {
        if (allSelected) next.add(f.path); else next.delete(f.path)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => setDeselected(new Set()), [])

  const selectNone = useCallback(() => {
    setDeselected(new Set(tree ? flattenFiles(tree).map(f => f.path) : []))
  }, [tree])

  return { isFileSelected, getGroupState, toggleFile, toggleGroup, selectAll, selectNone }
}
