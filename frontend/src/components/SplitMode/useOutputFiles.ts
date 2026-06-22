import { useState, useCallback, useMemo } from 'react'
import { PickFolder } from '../../../wailsjs/go/main/App'

export interface OutputFile {
  name: string
  folderOverride?: string
}

// Keyed by firstPage of each output section. firstPage 1 is always present.
type OutputFilesMap = Map<number, OutputFile>

export interface OutputFilesHandle {
  all: OutputFilesMap
  duplicateFirstPages: Set<number>
  getSplitPoints: () => Set<number>
  toggle: (afterPage: number, prefillName: string) => boolean
  setName: (firstPage: number, name: string) => void
  pickFolderOverride: (firstPage: number) => Promise<void>
  reset: (firstPageName: string) => void
}

export function useOutputFiles(outputFolder: string | null): OutputFilesHandle {
  const [files, setFiles] = useState<OutputFilesMap>(new Map([[1, { name: '' }]]))

  const toggle = (afterPage: number, prefillName: string): boolean => {
    const firstPage = afterPage + 1
    const adding = !files.has(firstPage)
    setFiles(prev => {
      const next = new Map(prev)
      if (next.has(firstPage)) {
        next.delete(firstPage)
      } else {
        next.set(firstPage, { name: prefillName })
      }
      return next
    })
    return adding
  }

  const setName = useCallback((firstPage: number, name: string) => {
    setFiles(prev => {
      const entry = prev.get(firstPage)
      if (!entry) return prev
      return new Map(prev).set(firstPage, { ...entry, name })
    })
  }, [])

  const pickFolderOverride = useCallback(async (firstPage: number) => {
    const folder = await PickFolder()
    if (!folder) return
    setFiles(prev => {
      const entry = prev.get(firstPage)
      if (!entry) return prev
      return new Map(prev).set(firstPage, { ...entry, folderOverride: folder })
    })
  }, [])

  const reset = useCallback((firstPageName: string) => {
    setFiles(new Map([[1, { name: firstPageName }]]))
  }, [])

  const duplicateFirstPages = useMemo(() => {
    const seen = new Map<string, number>()
    const dupes = new Set<number>()
    for (const [firstPage, file] of files.entries()) {
      const folder = file.folderOverride ?? outputFolder ?? ''
      const key = `${folder}::${file.name}`
      if (seen.has(key)) {
        dupes.add(firstPage)
        dupes.add(seen.get(key)!)
      } else {
        seen.set(key, firstPage)
      }
    }
    return dupes
  }, [files, outputFolder])

  const getSplitPoints = () => {
    const result = new Set<number>()
    for (const firstPage of files.keys()) {
      if (firstPage > 1) result.add(firstPage - 1)
    }
    return result
  }

  return {
    all: files,
    duplicateFirstPages,
    getSplitPoints,
    toggle,
    setName,
    pickFolderOverride,
    reset,
  }
}
