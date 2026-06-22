import { useRef, useLayoutEffect, useState } from 'react'
import { Tooltip } from '@mantine/core'

interface Props {
  path: string | null
  onClick: () => void
  placeholder?: string
}

// Displays a filesystem path, anchored to its right end so the filename is always visible.
// Uses scrollLeft (rather than direction:rtl) to avoid Unicode BiDi issues with the leading slash.
export default function ClippedPath({ path, onClick, placeholder = 'Choose folder…' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)

  // Runs before paint to avoid a flash of the unscrolled (left-anchored) path.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const overflows = el.scrollWidth > el.clientWidth
    setClipped(overflows)
    if (overflows) el.scrollLeft = el.scrollWidth
  }, [path])

  const inner = (
    <div style={{ position: 'relative' }}>
      {/* Overlay '…' at the left edge to signal that the path is truncated. */}
      {clipped && (
        <span style={{
          position: 'absolute', left: 0, fontSize: 11, pointerEvents: 'none',
          color: 'var(--mantine-color-gray-6)',
          background: 'var(--mantine-color-white)',
          paddingRight: 1,
        }}>…</span>
      )}
      <div
        ref={ref}
        onClick={onClick}
        style={{
          fontSize: 11,
          color: path ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-dimmed)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {path ?? placeholder}
      </div>
    </div>
  )

  return clipped && path
    ? <Tooltip label={path} openDelay={500}>{inner}</Tooltip>
    : inner
}
