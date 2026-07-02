import { Loader } from '@mantine/core'
import { IconRotateClockwise, IconX, IconArrowUp, IconArrowDown } from '@tabler/icons-react'
import * as pageCache from '../lib/pageCache'
import { ITEM_PADDING, LABEL_HEIGHT } from '../constants'

interface Props {
  src: string | undefined
  pdfPath: string
  page: number
  thumbHeight: number
  isSelected: boolean
  isSkipped: boolean
  rotation: number
  isHovered: boolean
  label: string
  onClick: () => void
  onRotate: () => void
  onToggleSkip: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export default function PageThumbnail({
  src, pdfPath, page, thumbHeight,
  isSelected, isSkipped, rotation,
  isHovered, label,
  onClick, onRotate, onToggleSkip,
  canMoveUp, canMoveDown, onMoveUp, onMoveDown,
}: Props) {
  const isRotated = rotation !== 0
  const showRotateBtn = isHovered || isRotated
  const isOddRotation = rotation === 90 || rotation === 270
  const imgTransform = rotation ? `rotate(${rotation}deg)${isOddRotation ? ` scale(${210 / 297})` : ''}` : undefined
  const showSkipBtn = isHovered || isSkipped
  const showMoveButtons = isHovered && (onMoveUp !== undefined || onMoveDown !== undefined)

  return (
    <div style={{ padding: ITEM_PADDING, paddingBottom: 0, cursor: 'pointer' }} onClick={onClick}>
      <div style={{
        position: 'relative',
        border: `2px solid ${isSelected ? 'var(--mantine-color-blue-5)' : 'transparent'}`,
        borderRadius: 4,
      }}>
        <div style={{ overflow: 'hidden', borderRadius: 2, background: 'var(--mantine-color-gray-1)' }}>
          {src ? (
            <img
              src={src}
              alt={`page ${page}`}
              style={{ width: '100%', display: 'block', opacity: isSkipped ? 0.3 : 1, transform: imgTransform }}
              draggable={false}
            />
          ) : (
            <div style={{ width: '100%', height: thumbHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pageCache.isLoading(pdfPath, page) && <Loader size="xs" />}
            </div>
          )}
        </div>
        {showRotateBtn && (
          <button
            type="button"
            aria-label="Rotate page clockwise"
            onClick={(e) => { e.stopPropagation(); onRotate() }}
            style={{
              position: 'absolute', top: 3, left: 3,
              width: 16, height: 16, borderRadius: 3, border: 'none', padding: 0,
              background: isRotated ? 'var(--mantine-color-blue-6)' : 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white',
            }}
          >
            <IconRotateClockwise size={10} stroke={3} />
          </button>
        )}
        {showSkipBtn && (
          <button
            type="button"
            aria-label={isSkipped ? 'Unskip page' : 'Skip page'}
            onClick={(e) => { e.stopPropagation(); onToggleSkip() }}
            style={{
              position: 'absolute', top: 3, right: 3,
              width: 16, height: 16, borderRadius: 3, border: 'none', padding: 0,
              background: isSkipped ? 'var(--mantine-color-orange-6)' : 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white',
            }}
          >
            <IconX size={10} stroke={3} />
          </button>
        )}
        {showMoveButtons && (
          <>
            <button
              type="button"
              aria-label="Move page up"
              disabled={!canMoveUp}
              onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
              style={{
                position: 'absolute', bottom: 3, left: 3,
                width: 16, height: 16, borderRadius: 3, border: 'none', padding: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canMoveUp ? 'pointer' : 'default',
                color: 'white',
                opacity: canMoveUp ? 1 : 0.3,
              }}
            >
              <IconArrowUp size={10} stroke={3} />
            </button>
            <button
              type="button"
              aria-label="Move page down"
              disabled={!canMoveDown}
              onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
              style={{
                position: 'absolute', bottom: 3, right: 3,
                width: 16, height: 16, borderRadius: 3, border: 'none', padding: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canMoveDown ? 'pointer' : 'default',
                color: 'white',
                opacity: canMoveDown ? 1 : 0.3,
              }}
            >
              <IconArrowDown size={10} stroke={3} />
            </button>
          </>
        )}
      </div>
      <div style={{
        textAlign: 'center',
        fontSize: 11,
        color: isSkipped ? 'var(--mantine-color-gray-5)' : 'var(--mantine-color-gray-7)',
        height: LABEL_HEIGHT,
        lineHeight: `${LABEL_HEIGHT}px`,
      }}>
        {label}
      </div>
    </div>
  )
}
