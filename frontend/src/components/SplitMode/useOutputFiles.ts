import { useState, useCallback } from 'react'

export interface OutputFile {
  name: string
  folderOverride?: string
}

// Keyed by firstPage of each output section. firstPage 1 is always present.
type OutputFilesMap = Map<number, OutputFile>

export interface OutputFilesHandle {
  all: OutputFilesMap
  getSplitPoints: () => Set<number>
  toggle: (afterPage: number, prefillName: string) => boolean
  setName: (firstPage: number, name: string) => void
  setFolderOverride: (firstPage: number, folder: string) => void
  reset: (firstPageName: string) => void
}

export function useOutputFiles(): OutputFilesHandle {
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

  const setFolderOverride = useCallback((firstPage: number, folder: string) => {
    setFiles(prev => {
      const entry = prev.get(firstPage)
      if (!entry) return prev
      return new Map(prev).set(firstPage, { ...entry, folderOverride: folder })
    })
  }, [])

  const reset = useCallback((firstPageName: string) => {
    setFiles(new Map([[1, { name: firstPageName }]]))
  }, [])

  const getSplitPoints = () => {
    const result = new Set<number>()
    for (const firstPage of files.keys()) {
      if (firstPage > 1) result.add(firstPage - 1)
    }
    return result
  }

  return {
    all: files,
    getSplitPoints,
    toggle,
    setName,
    setFolderOverride,
    reset,
  }
}
