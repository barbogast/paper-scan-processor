import { Loader, Tooltip } from '@mantine/core'
import { IconRotateClockwise, IconX, IconArrowUp, IconArrowDown, IconPhotoOff } from '@tabler/icons-react'
import * as pageCache from '../lib/pageCache'
import { ITEM_PADDING, LABEL_HEIGHT } from '../constants'
import styles from './PageThumbnail.module.css'

interface Props {
  src: string | undefined
  pdfPath: string
  page: number
  thumbHeight: number
  isSelected: boolean
  isSkipped: boolean
  rotation: number
  label: string
  onClick: () => void
  onRotate?: () => void
  onToggleSkip?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export default function PageThumbnail({
  src, pdfPath, page, thumbHeight,
  isSelected, isSkipped, rotation, label,
  onClick, onRotate, onToggleSkip,
  canMoveUp, canMoveDown, onMoveUp, onMoveDown,
}: Props) {
  const isRotated = rotation !== 0
  const isOddRotation = rotation === 90 || rotation === 270
  const imgTransform = rotation ? `rotate(${rotation}deg)${isOddRotation ? ` scale(${210 / 297})` : ''}` : undefined
  const showMoveButtons = onMoveUp !== undefined || onMoveDown !== undefined

  return (
    <div className={styles.wrapper} style={{ padding: ITEM_PADDING, paddingBottom: 0 }} onClick={onClick}>
      <div className={`${styles.frame} ${isSelected ? styles.frameSelected : ''}`}>
        <div className={styles.imageContainer}>
          {src ? (
            <img
              src={src}
              alt={`page ${page}`}
              className={styles.image}
              style={{ opacity: isSkipped ? 0.3 : 1, transform: imgTransform }}
              draggable={false}
            />
          ) : (
            <div className={styles.placeholder} style={{ height: thumbHeight }}>
              {pageCache.isLoading(pdfPath, page) && <Loader size="xs" />}
              {!pageCache.isLoading(pdfPath, page) && pageCache.isFailed(pdfPath, page) && (
                <Tooltip label={pageCache.getFailureMessage(pdfPath, page) ?? 'Failed to render page'} openDelay={500}>
                  <IconPhotoOff size={16} color="var(--mantine-color-red-6)" />
                </Tooltip>
              )}
            </div>
          )}
        </div>
        {onRotate && (
          <ThumbnailIconButton
            ariaLabel="Rotate page clockwise"
            onClick={onRotate}
            position={{ top: 3, left: 3 }}
            active={isRotated}
            icon={<IconRotateClockwise size={10} stroke={3} />}
          />
        )}
        {onToggleSkip && (
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
      <div
        className={`${styles.label} ${isSkipped ? styles.labelSkipped : ''}`}
        style={{ height: LABEL_HEIGHT, lineHeight: `${LABEL_HEIGHT}px` }}
      >
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
      className={`${styles.iconBtn} ${active ? styles.iconBtnActive : ''} ${disabled ? styles.iconBtnDisabled : ''}`}
      style={{
        ...position,
        background: active ? activeColor : 'rgba(0,0,0,0.45)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {icon}
    </button>
  )
}
