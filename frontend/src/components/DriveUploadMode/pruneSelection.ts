import { LocalFileGroup } from './useFileTree'
import { SelectionItem } from './useSelection'

// All ancestor group keys of a group key, from outermost to the key itself
// — e.g. "invoices/2026/jan" -> ["invoices", "invoices/2026", "invoices/2026/jan"]
// — derived from the '/'-joined key scheme GroupNode/FileList use to
// identify groups, without needing to walk the tree.
function keyChain(groupKey: string): string[] {
  const parts = groupKey.split('/')
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
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

// Drops any selected item that's a descendant of another selected subfolder,
// so a batch assignment gives only the topmost selected item in each
// subtree its own assignment and leaves the rest to inherit it — instead of
// pinning every descendant with a redundant override that could later
// diverge from its ancestor's.
export function pruneSelectionForAssignment(tree: LocalFileGroup, items: SelectionItem[]): SelectionItem[] {
  const selectedGroupKeys = new Set(items.filter(i => i.type === 'group').map(i => i.key))
  const parentKeys = fileParentKeys(tree)

  return items.filter(item => {
    if (item.type === 'group') {
      const ancestors = keyChain(item.key).slice(0, -1)
      return !ancestors.some(k => selectedGroupKeys.has(k))
    }
    const parentKey = parentKeys.get(item.path) ?? null
    if (parentKey === null) return true
    return !keyChain(parentKey).some(k => selectedGroupKeys.has(k))
  })
}
