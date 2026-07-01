import { useState, useCallback, useMemo } from 'react'
import { PickFolder } from '../../../wailsjs/go/main/App'

export interface OutputFile {
  name: string
  folderOverride?: string
}

// Keyed by firstPosition (0-indexed position in pageOrder). Position 0 is always present.
type OutputFilesMap = Map<number, OutputFile>

export interface OutputFilesHandle {
  all: OutputFilesMap
  duplicateFirstPages: Set<number>
  getSplitPoints: () => Set<number>
  toggle: (afterPosition: number, prefillName: string) => boolean
  setName: (firstPosition: number, name: string) => void
  pickFolderOverride: (firstPosition: number) => Promise<void>
  reset: (firstPageName: string) => void
}

export function useOutputFiles(outputFolder: string | null): OutputFilesHandle {
  const [files, setFiles] = useState<OutputFilesMap>(new Map([[0, { name: '' }]]))

  const toggle = (afterPosition: number, prefillName: string): boolean => {
    const firstPosition = afterPosition + 1
    const adding = !files.has(firstPosition)
    setFiles(prev => {
      const next = new Map(prev)
      if (next.has(firstPosition)) {
        next.delete(firstPosition)
      } else {
        next.set(firstPosition, { name: prefillName })
      }
      return next
    })
    return adding
  }

  const setName = useCallback((firstPosition: number, name: string) => {
    setFiles(prev => {
      const entry = prev.get(firstPosition)
      if (!entry) return prev
      return new Map(prev).set(firstPosition, { ...entry, name })
    })
  }, [])

  const pickFolderOverride = useCallback(async (firstPosition: number) => {
    const folder = await PickFolder()
    if (!folder) return
    setFiles(prev => {
      const entry = prev.get(firstPosition)
      if (!entry) return prev
      return new Map(prev).set(firstPosition, { ...entry, folderOverride: folder })
    })
  }, [])

  const reset = useCallback((firstPageName: string) => {
    setFiles(new Map([[0, { name: firstPageName }]]))
  }, [])

  const duplicateFirstPages = useMemo(() => {
    const seen = new Map<string, number>()
    const dupes = new Set<number>()
    for (const [firstPosition, file] of files.entries()) {
      const folder = file.folderOverride ?? outputFolder ?? ''
      const key = `${folder}::${file.name}`
      if (seen.has(key)) {
        dupes.add(firstPosition)
        dupes.add(seen.get(key)!)
      } else {
        seen.set(key, firstPosition)
      }
    }
    return dupes
  }, [files, outputFolder])

  // Returns positions after which a split occurs (i.e., firstPosition - 1 for each section > 0).
  const getSplitPoints = () => {
    const result = new Set<number>()
    for (const firstPosition of files.keys()) {
      if (firstPosition > 0) result.add(firstPosition - 1)
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
