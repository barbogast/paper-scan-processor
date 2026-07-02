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
          <ThumbnailIconButton
            ariaLabel="Rotate page clockwise"
            onClick={onRotate}
            position={{ top: 3, left: 3 }}
            active={isRotated}
            icon={<IconRotateClockwise size={10} stroke={3} />}
          />
        )}
        {showSkipBtn && (
          <ThumbnailIconButton
            ariaLabel={isSkipped ? 'Unskip page' : 'Skip page'}
            onClick={onToggleSkip}
            position={{ top: 3, right: 3 }}
            active={isSkipped}
            activeColor="var(--mantine-color-orange-6)"
            icon={<IconX size={10} stroke={3} />}
          />
        )}
        {showMoveButtons && (
          <>
            <ThumbnailIconButton
              ariaLabel="Move page up"
              onClick={() => onMoveUp?.()}
              position={{ bottom: 3, left: 3 }}
              disabled={!canMoveUp}
              icon={<IconArrowUp size={10} stroke={3} />}
            />
            <ThumbnailIconButton
              ariaLabel="Move page down"
              onClick={() => onMoveDown?.()}
              position={{ bottom: 3, right: 3 }}
              disabled={!canMoveDown}
              icon={<IconArrowDown size={10} stroke={3} />}
            />
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

interface ThumbnailIconButtonProps {
  ariaLabel: string
  onClick: () => void
  icon: React.ReactNode
  position: { top?: number; bottom?: number; left?: number; right?: number }
  active?: boolean
  activeColor?: string
  disabled?: boolean
}

function ThumbnailIconButton({
  ariaLabel, onClick, icon, position,
  active = false, activeColor = 'var(--mantine-color-blue-6)', disabled = false,
}: ThumbnailIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        position: 'absolute',
        ...position,
        width: 16, height: 16, borderRadius: 3, border: 'none', padding: 0,
        background: active ? activeColor : 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        color: 'white',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {icon}
    </button>
  )
}
