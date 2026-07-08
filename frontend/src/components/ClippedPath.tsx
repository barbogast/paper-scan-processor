import { useRef } from 'react'
import { Tooltip } from '@mantine/core'
import { useIsTruncated } from '../lib/useIsTruncated'

interface Props {
  path: string | null
  onClick: () => void
  placeholder?: string
}

// Displays a filesystem path, anchored to its right end so the filename is always visible.
// Uses scrollLeft (rather than direction:rtl) to avoid Unicode BiDi issues with the leading slash.
export default function ClippedPath({ path, onClick, placeholder = 'Choose folder…' }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const clipped = useIsTruncated(ref, path, { scrollToEnd: true })

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
      <button
        type="button"
        ref={ref}
        onClick={onClick}
        aria-label={path ? `Change destination folder (currently ${path})` : placeholder}
        style={{
          display: 'block',
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: 0,
          textAlign: 'left',
          fontSize: 11,
          fontFamily: 'inherit',
          color: path ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-dimmed)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {path ?? placeholder}
      </button>
    </div>
  )

  return clipped && path
    ? <Tooltip label={path} openDelay={500}>{inner}</Tooltip>
    : inner
}
