import { DRAG_HANDLE_WIDTH } from '../constants'
import styles from './ResizeHandle.module.css'

interface Props {
  onMouseDown: (e: React.MouseEvent) => void
}

export default function ResizeHandle({ onMouseDown }: Props) {
  return <div className={styles.handle} onMouseDown={onMouseDown} style={{ width: DRAG_HANDLE_WIDTH }} />
}
