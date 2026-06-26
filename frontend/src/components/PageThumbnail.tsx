import { Loader } from '@mantine/core'
import { IconRotateClockwise, IconX, IconGripVertical } from '@tabler/icons-react'
import * as pageCache from '../hooks/pageCache'
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
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export default function PageThumbnail({
  src, pdfPath, page, thumbHeight,
  isSelected, isSkipped, rotation,
  isHovered, label,
  onClick, onRotate, onToggleSkip,
  dragHandleProps,
}: Props) {
  const isRotated = rotation !== 0
  const showRotateBtn = isHovered || isRotated
  const isOddRotation = rotation === 90 || rotation === 270
  const imgTransform = rotation ? `rotate(${rotation}deg)${isOddRotation ? ` scale(${210 / 297})` : ''}` : undefined
  const showSkipBtn = isHovered || isSkipped

  return (
    <div style={{ padding: ITEM_PADDING, paddingBottom: 0, cursor: 'pointer', position: 'relative' }} onClick={onClick}>
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
          <div
            onClick={(e) => { e.stopPropagation(); onRotate() }}
            style={{
              position: 'absolute', top: 3, left: 3,
              width: 16, height: 16, borderRadius: 3,
              background: isRotated ? 'var(--mantine-color-blue-6)' : 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white',
            }}
          >
            <IconRotateClockwise size={10} stroke={3} />
          </div>
        )}
        {showSkipBtn && (
          <div
            onClick={(e) => { e.stopPropagation(); onToggleSkip() }}
            style={{
              position: 'absolute', top: 3, right: 3,
              width: 16, height: 16, borderRadius: 3,
              background: isSkipped ? 'var(--mantine-color-orange-6)' : 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white',
            }}
          >
            <IconX size={10} stroke={3} />
          </div>
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
      {dragHandleProps && isHovered && (
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: LABEL_HEIGHT + 4, right: ITEM_PADDING + 2,
            width: 16, height: 16, borderRadius: 3,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', color: 'white',
          }}
        >
          <IconGripVertical size={10} stroke={3} />
        </div>
      )}
    </div>
  )
}
