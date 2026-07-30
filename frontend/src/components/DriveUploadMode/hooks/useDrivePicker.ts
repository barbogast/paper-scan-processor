import { useState } from 'react'
import { pruneSelectionForAssignment } from '../pruneSelection'
import { SelectionHandle } from './useSelection'
import { DriveAssignmentsHandle } from './useDriveAssignments'
import { LocalFileGroup, DriveAssignment, SelectionItem } from '../types'

export interface DrivePickerHandle {
  opened: boolean
  pickOne: (target: SelectionItem) => void
  pickSelection: () => void
  apply: (folder: DriveAssignment) => void
  close: () => void
}

// One or more targets for the currently open folder picker: a single-item
// array for a per-row badge click (pickOne), or the pruned multi-selection
// for the toolbar batch action (pickSelection) — either way, the picked
// folder applies to every target here.
export function useDrivePicker(tree: LocalFileGroup | null, selection: SelectionHandle, assignments: DriveAssignmentsHandle): DrivePickerHandle {
  const [targets, setTargets] = useState<SelectionItem[] | null>(null)

  const pickOne = (target: SelectionItem) => setTargets([target])

  const pickSelection = () => {
    if (!tree) return
    setTargets(pruneSelectionForAssignment(tree, selection.items))
  }

  const apply = (folder: DriveAssignment) => {
    for (const target of targets ?? []) {
      if (target.type === 'group') assignments.setGroupAssignment(target.key, folder)
      else assignments.setFileOverride(target.path, folder)
    }
    setTargets(null)
  }

  const close = () => setTargets(null)

  return { opened: targets !== null, pickOne, pickSelection, apply, close }
}
