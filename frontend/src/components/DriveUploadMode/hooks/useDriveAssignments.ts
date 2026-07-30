import { useState, useCallback } from 'react'
import { LocalFileGroup, DriveAssignment } from '../types'

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

// Effective Drive assignment for every file in the tree: its own override,
// else the nearest ancestor group's assignment (looked up by the tree's own
// group.key), else null. Usable outside a render tree — e.g. to check
// whether every file is ready to upload, or to build an upload job list.
export function resolveEffectiveAssignments(
  tree: LocalFileGroup,
  { groupAssignments, fileOverrides }: Pick<DriveAssignmentsHandle, 'groupAssignments' | 'fileOverrides'>
): Map<string, DriveAssignment | null> {
  const result = new Map<string, DriveAssignment | null>()

  const walk = (group: LocalFileGroup, inherited: DriveAssignment | null) => {
    const effective = (group.key !== null ? groupAssignments.get(group.key) : undefined) ?? inherited
    for (const file of group.files) {
      result.set(file.path, fileOverrides.get(file.path) ?? effective)
    }
    for (const sub of group.subgroups) {
      walk(sub, effective)
    }
  }
  walk(tree, null)

  return result
}
