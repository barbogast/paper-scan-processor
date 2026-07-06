import { useState, useCallback } from 'react'

export interface DriveAssignment {
  driveFolderId: string
  path: string
}

// Identifies what a picked Drive folder should be applied to: a subfolder
// group (by its path key) or an individual file (by its filesystem path).
export type PickerTarget = { type: 'group'; key: string } | { type: 'file'; path: string }

export interface DriveAssignmentsHandle {
  groupAssignments: Map<string, DriveAssignment>
  fileOverrides: Map<string, DriveAssignment>
  setGroupAssignment: (groupKey: string, assignment: DriveAssignment) => void
  clearGroupAssignment: (groupKey: string) => void
  setFileOverride: (filePath: string, assignment: DriveAssignment) => void
  clearFileOverride: (filePath: string) => void
}

// Tracks Drive folder assignments made directly on a subfolder group or on
// an individual file (a file-level assignment overrides its group's).
// Resolving the *effective* assignment for a given group/file (own, else
// inherited from the nearest ancestor group, else none) is the caller's
// job, since only the caller knows the tree structure to walk.
export function useDriveAssignments(): DriveAssignmentsHandle {
  const [groupAssignments, setGroupAssignments] = useState<Map<string, DriveAssignment>>(new Map())
  const [fileOverrides, setFileOverrides] = useState<Map<string, DriveAssignment>>(new Map())

  const setGroupAssignment = useCallback((groupKey: string, assignment: DriveAssignment) => {
    setGroupAssignments(prev => new Map(prev).set(groupKey, assignment))
  }, [])

  const clearGroupAssignment = useCallback((groupKey: string) => {
    setGroupAssignments(prev => {
      const next = new Map(prev)
      next.delete(groupKey)
      return next
    })
  }, [])

  const setFileOverride = useCallback((filePath: string, assignment: DriveAssignment) => {
    setFileOverrides(prev => new Map(prev).set(filePath, assignment))
  }, [])

  const clearFileOverride = useCallback((filePath: string) => {
    setFileOverrides(prev => {
      const next = new Map(prev)
      next.delete(filePath)
      return next
    })
  }, [])

  return { groupAssignments, fileOverrides, setGroupAssignment, clearGroupAssignment, setFileOverride, clearFileOverride }
}
