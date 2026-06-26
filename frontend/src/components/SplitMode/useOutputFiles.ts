import { useState, useCallback, useMemo } from 'react'
import { PickFolder } from '../../../wailsjs/go/main/App'

export interface OutputFile {
  name: string
  folderOverride?: string
}

export interface OutputFilesHandle {
  files: OutputFile[]
  splitPoints: Set<number>       // display indices after which a new segment begins
  duplicates: Set<number>        // segment indices with duplicate name+folder
  toggle: (afterDisplayIndex: number, prefillName: string) => { added: boolean; segmentIndex: number }
  setName: (segmentIndex: number, name: string) => void
  pickFolderOverride: (segmentIndex: number) => Promise<void>
  reset: (firstSegmentName: string) => void
}

export function useOutputFiles(outputFolder: string | null): OutputFilesHandle {
  const [files, setFiles] = useState<OutputFile[]>([{ name: '' }])
  const [splitPoints, setSplitPoints] = useState<Set<number>>(() => new Set())

  const toggle = (afterDisplayIndex: number, prefillName: string) => {
    const adding = !splitPoints.has(afterDisplayIndex)
    // Count split points strictly before afterDisplayIndex to find the segment index
    // of the segment that ends at afterDisplayIndex. The new segment is one beyond that.
    const segmentIndex = [...splitPoints].filter(p => p < afterDisplayIndex).length + 1

    setSplitPoints(prev => {
      const next = new Set(prev)
      if (next.has(afterDisplayIndex)) next.delete(afterDisplayIndex); else next.add(afterDisplayIndex)
      return next
    })
    setFiles(prev => {
      const next = [...prev]
      if (adding) {
        next.splice(segmentIndex, 0, { name: prefillName })
      } else {
        next.splice(segmentIndex, 1)
      }
      return next
    })
    return { added: adding, segmentIndex }
  }

  const setName = useCallback((segmentIndex: number, name: string) => {
    setFiles(prev => {
      if (!prev[segmentIndex]) return prev
      const next = [...prev]
      next[segmentIndex] = { ...next[segmentIndex], name }
      return next
    })
  }, [])

  const pickFolderOverride = useCallback(async (segmentIndex: number) => {
    const folder = await PickFolder()
    if (!folder) return
    setFiles(prev => {
      if (!prev[segmentIndex]) return prev
      const next = [...prev]
      next[segmentIndex] = { ...next[segmentIndex], folderOverride: folder }
      return next
    })
  }, [])

  const reset = useCallback((firstSegmentName: string) => {
    setFiles([{ name: firstSegmentName }])
    setSplitPoints(new Set())
  }, [])

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>()
    const dupes = new Set<number>()
    for (let i = 0; i < files.length; i++) {
      const folder = files[i].folderOverride ?? outputFolder ?? ''
      const key = `${folder}::${files[i].name}`
      if (seen.has(key)) {
        dupes.add(i)
        dupes.add(seen.get(key)!)
      } else {
        seen.set(key, i)
      }
    }
    return dupes
  }, [files, outputFolder])

  return { files, splitPoints, duplicates, toggle, setName, pickFolderOverride, reset }
}
