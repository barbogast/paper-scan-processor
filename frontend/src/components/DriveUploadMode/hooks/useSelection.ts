import { useState, useCallback, useEffect } from 'react'
import { LocalFileGroup, SelectionItem } from '../types'

function itemKey(item: SelectionItem): string {
  return item.type === 'file' ? `file:${item.path}` : `group:${item.key}`
}

export interface SelectionHandle {
  size: number
  items: SelectionItem[]
  isSelected: (item: SelectionItem) => boolean
  // Plain click: replaces the selection with just this item.
  replace: (item: SelectionItem) => void
  // Cmd/Ctrl-click: adds or removes this item from the existing selection.
  toggle: (item: SelectionItem) => void
}

// The shared multi-selection of files and subfolders driving both row
// highlighting and (Step 3e) batch Drive folder assignment — a single
// selection concept rather than a separate preview-only highlight.
export function useSelection(tree: LocalFileGroup | null): SelectionHandle {
  const [selected, setSelected] = useState<Map<string, SelectionItem>>(new Map())

  // Resets on every fresh scan, like inclusion — a new root's rows aren't
  // the ones that were selected under the old one.
  useEffect(() => {
    setSelected(new Map())
  }, [tree])

  const isSelected = useCallback((item: SelectionItem) => selected.has(itemKey(item)), [selected])

  const replace = useCallback((item: SelectionItem) => {
    setSelected(new Map([[itemKey(item), item]]))
  }, [])

  const toggle = useCallback((item: SelectionItem) => {
    setSelected(prev => {
      const key = itemKey(item)
      const next = new Map(prev)
      if (next.has(key)) next.delete(key); else next.set(key, item)
      return next
    })
  }, [])

  return { size: selected.size, items: Array.from(selected.values()), isSelected, replace, toggle }
}
