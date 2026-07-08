import { useState, useCallback } from 'react'
import { PickFolder, ScanLocalRoot } from '../../../wailsjs/go/main/App'

export interface LocalFile {
  path: string
  name: string
  sizeBytes: number
  isPdf: boolean
  pageCount: number
  corrupt: boolean
}

export interface LocalFileGroup {
  name: string
  files: LocalFile[]
  subgroups: LocalFileGroup[]
}

export interface FileTreeHandle {
  root: string | null
  tree: LocalFileGroup | null
  loading: boolean
  error: string | null
  pickRoot: () => Promise<void>
}

export function useFileTree(): FileTreeHandle {
  const [root, setRoot] = useState<string | null>(null)
  const [tree, setTree] = useState<LocalFileGroup | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickRoot = useCallback(async () => {
    const folder = await PickFolder('Choose Root Folder')
    if (!folder) return

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
  }, [])

  return { root, tree, loading, error, pickRoot }
}
