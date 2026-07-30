import { LocalFileGroup } from './useFileTree'
import { SelectionItem } from './useSelection'

// The key of the group directly containing groupKey, or null if it's top-level.
function parentGroupKey(groupKey: string): string | null {
  const idx = groupKey.lastIndexOf('/')
  return idx === -1 ? null : groupKey.slice(0, idx)
}

// Maps every file's path to its immediate parent group's key, or null for a
// root-level file with no group to inherit from.
function fileParentKeys(tree: LocalFileGroup): Map<string, string | null> {
  const result = new Map<string, string | null>()
  const walk = (group: LocalFileGroup, groupKey: string | null) => {
    for (const file of group.files) result.set(file.path, groupKey)
    for (const sub of group.subgroups) {
      walk(sub, groupKey !== null ? `${groupKey}/${sub.name}` : sub.name)
    }
  }
  walk(tree, null)
  return result
}

// Whether groupKey or any of its ancestors is in selectedGroupKeys.
function hasSelectedAncestor(groupKey: string | null, selectedGroupKeys: Set<string>): boolean {
  for (let key = groupKey; key !== null; key = parentGroupKey(key)) {
    if (selectedGroupKeys.has(key)) return true
  }
  return false
}

// Drops any selected item that's a descendant of another selected subfolder,
// so a batch assignment gives only the topmost selected item in each
// subtree its own assignment and leaves the rest to inherit it — instead of
// pinning every descendant with a redundant override that could later
// diverge from its ancestor's.
export function pruneSelectionForAssignment(tree: LocalFileGroup, items: SelectionItem[]): SelectionItem[] {
  const selectedGroupKeys = new Set(items.filter(i => i.type === 'group').map(i => i.key))
  const parentKeys = fileParentKeys(tree)

  return items.filter(item => {
    const parentKey = item.type === 'group' ? parentGroupKey(item.key) : parentKeys.get(item.path) ?? null
    return !hasSelectedAncestor(parentKey, selectedGroupKeys)
  })
}
