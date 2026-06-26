import { useState, useCallback } from 'react'

export interface PendingFocusHandle {
  pendingFocus: { segmentIndex: number; cursorPos: number } | null
  clear: () => void
  request: (segmentIndex: number, cursorPos: number) => void
}

// Tracks which filename input should steal focus after a split point is added,
// and where the cursor should land within it. Cleared by the input itself once
// it has focused, so only the first render after the split point is added fires.
export function usePendingFocus(): PendingFocusHandle {
  const [pendingFocus, setPendingFocus] = useState<{ segmentIndex: number; cursorPos: number } | null>(null)
  const request = useCallback((segmentIndex: number, cursorPos: number) => setPendingFocus({ segmentIndex, cursorPos }), [])
  const clear = useCallback(() => setPendingFocus(null), [])
  return { pendingFocus, request, clear }
}
