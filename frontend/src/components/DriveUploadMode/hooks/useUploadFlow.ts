import { useState } from 'react'
import { flattenFiles } from './useFileTree'
import { resolveEffectiveAssignments, DriveAssignmentsHandle } from './useDriveAssignments'
import { InclusionHandle } from './useInclusion'
import { LocalFileGroup } from '../types'
import * as uploadQueue from '../uploadQueue'

export interface UploadFlowHandle {
  started: boolean
  uploadModalOpen: boolean
  readyToUpload: boolean
  startUpload: () => void
  closeUploadModal: () => void
  reset: () => void
}

// Once Upload All is clicked, the tree locks for the rest of this tree's
// session — the upload starts immediately, so there's no "in progress but
// not locked yet" window to account for. Retrying failed files happens
// inside the upload modal, not from here, so `started` never goes back to
// false except via reset (a fresh root pick).
export function useUploadFlow(tree: LocalFileGroup | null, inclusion: InclusionHandle, assignments: DriveAssignmentsHandle): UploadFlowHandle {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [started, setStarted] = useState(false)

  const allFiles = tree ? flattenFiles(tree) : []
  const selectedFiles = allFiles.filter(f => inclusion.isFileSelected(f.path))
  const effectiveAssignments = tree ? resolveEffectiveAssignments(tree, assignments) : null
  const readyToUpload = selectedFiles.length > 0 && selectedFiles.every(f => effectiveAssignments!.get(f.path) != null)

  const startUpload = () => {
    if (!tree || !effectiveAssignments) return
    uploadQueue.start(selectedFiles.map(f => {
      const assignment = effectiveAssignments.get(f.path)
      // Upload All is disabled until readyToUpload is true, so every file
      // should resolve here — this is a defensive check against that
      // guard and this walk drifting out of sync, not an expected path.
      if (!assignment) throw new Error(`No Drive folder assigned for "${f.path}"`)
      return { path: f.path, folderId: assignment.driveFolderId, name: f.name }
    }))
    setStarted(true)
    setUploadModalOpen(true)
  }

  const closeUploadModal = () => setUploadModalOpen(false)

  // A new root discards the old tree's upload-queue state along with it —
  // picking a new root is the only way out of the read-only lock.
  const reset = () => {
    uploadQueue.reset()
    setStarted(false)
  }

  return { started, uploadModalOpen, readyToUpload, startUpload, closeUploadModal, reset }
}
