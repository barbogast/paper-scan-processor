import { useState, useEffect } from 'react'
import { LocalFile } from '../types'
import * as pageCache from '../../../lib/pageCache'

export interface PreviewHandle {
  file: LocalFile | null
  page: number
  setFile: (file: LocalFile) => void
  setPage: (page: number) => void
}

// The last previewable file touched by a click — independent of the
// multi-selection (see useSelection): any click on a previewable file
// updates this, whether it's adding or removing that file from the
// selection, while clicking a subfolder or a non-previewable file leaves
// it as whatever was last previewed.
export function usePreview(): PreviewHandle {
  const [file, setFileState] = useState<LocalFile | null>(null)
  const [page, setPage] = useState(1)

  const setFile = (f: LocalFile) => {
    setFileState(f)
    setPage(1)
  }

  useEffect(() => {
    return () => { if (file) pageCache.evict(file.path) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.path])

  return { file, page, setFile, setPage }
}
