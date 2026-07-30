import { useState, useCallback } from 'react'
import { PickFolder, ScanLocalRoot } from '../../../../wailsjs/go/main/App'
import { LocalFile, LocalFileGroup } from '../types'

// Flat, ordered list of every file in the tree (a group's own files, then
// its subgroups' files, recursively). Shared by the upload worker (order to
// process files in), the upload modal's per-group rollup counts, and the
// "every file in this group is done" check driving the Open-in-Drive link —
// one traversal so they can't drift out of sync on how they handle nesting.
export function flattenFiles(group: LocalFileGroup): LocalFile[] {
  return [...group.files, ...group.subgroups.flatMap(flattenFiles)]
}

export interface FileTreeHandle {
  root: string | null
  tree: LocalFileGroup | null
  loading: boolean
  error: string | null
  // Resolves to whether a folder was actually picked (false if the user
  // cancelled the dialog), so callers know when a fresh root replaced the
  // previous one and any per-root state (e.g. the upload queue) should reset.
  pickRoot: () => Promise<boolean>
}

// Owns the currently scanned local folder: which root the user picked, the
// resulting file/subgroup tree, and loading/error state while ScanLocalRoot
// runs. The scan is an async Go RPC that can fail (bad permissions, folder
// moved/deleted mid-pick, etc.), so this state needs to live outside the
// tree itself — callers can show a spinner or an error message instead of
// rendering a stale or partial tree while a scan is in flight.
export function useFileTree(): FileTreeHandle {
  const [root, setRoot] = useState<string | null>(null)
  const [tree, setTree] = useState<LocalFileGroup | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickRoot = useCallback(async () => {
    const folder = await PickFolder('Choose Root Folder')
    if (!folder) return false

    setRoot(folder)
    setLoading(true)
    setError(null)
    try {
      setTree(await ScanLocalRoot(folder))
    } catch (e) {
      setTree(null)
      setError(String(e))
    } finally {
      setLoading(false)
    }
    return true
  }, [])

  return { root, tree, loading, error, pickRoot }
}
