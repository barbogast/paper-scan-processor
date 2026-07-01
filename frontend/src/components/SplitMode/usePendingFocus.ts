import { useState, useCallback } from 'react'

export interface PendingFocusHandle {
  pendingFocus: { afterPosition: number; cursorPos: number } | null
  clear: () => void
  request: (afterPosition: number, cursorPos: number) => void
}

// Tracks which filename input should steal focus after a split point is added,
// and where the cursor should land within it. Cleared by the input itself once
// it has focused, so only the first render after the split point is added fires.
export function usePendingFocus(): PendingFocusHandle {
  const [pendingFocus, setPendingFocus] = useState<{ afterPosition: number; cursorPos: number } | null>(null)
  const request = useCallback((afterPosition: number, cursorPos: number) => setPendingFocus({ afterPosition, cursorPos }), [])
  const clear = useCallback(() => setPendingFocus(null), [])
  return { pendingFocus, request, clear }
}
