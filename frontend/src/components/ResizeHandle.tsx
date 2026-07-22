import { DRAG_HANDLE_WIDTH } from '../constants'

interface Props {
  onMouseDown: (e: React.MouseEvent) => void
}

export default function ResizeHandle({ onMouseDown }: Props) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: DRAG_HANDLE_WIDTH,
        height: '100%',
        cursor: 'col-resize',
        flexShrink: 0,
        background: 'var(--mantine-color-gray-3)',
      }}
    />
  )
}
