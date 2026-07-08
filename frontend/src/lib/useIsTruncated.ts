import { RefObject, useLayoutEffect, useState } from 'react'

// Detects whether a ref'd element's content is being clipped by CSS overflow,
// so callers can conditionally show a tooltip with the untruncated text.
// Runs in useLayoutEffect (before paint) so there's no flash of unclipped state.
export function useIsTruncated(ref: RefObject<HTMLElement | null>, dep: unknown, options?: { scrollToEnd?: boolean }) {
  const [truncated, setTruncated] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const overflows = el.scrollWidth > el.clientWidth
    setTruncated(overflows)
    if (overflows && options?.scrollToEnd) el.scrollLeft = el.scrollWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])

  return truncated
}
