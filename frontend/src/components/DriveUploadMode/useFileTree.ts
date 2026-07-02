import { useState, useCallback } from 'react'
import { PickFolder, ScanLocalRoot } from '../../../wailsjs/go/main/App'

export interface LocalFile {
  path: string
  name: string
  sizeBytes: number
  pageCount: number
  corrupt: boolean
}

export interface LocalFileGroup {
  name: string
  files: LocalFile[]
}

export interface FileTreeHandle {
  root: string | null
  groups: LocalFileGroup[]
  loading: boolean
  error: string | null
  pickRoot: () => Promise<void>
}

export function useFileTree(): FileTreeHandle {
  const [root, setRoot] = useState<string | null>(null)
  const [groups, setGroups] = useState<LocalFileGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickRoot = useCallback(async () => {
    const folder = await PickFolder('Choose Root Folder')
    if (!folder) return

    setRoot(folder)
    setLoading(true)
    setError(null)
    try {
      setGroups(await ScanLocalRoot(folder))
    } catch (e) {
      setGroups([])
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return { root, groups, loading, error, pickRoot }
}
