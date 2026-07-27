import { ITEM_PADDING, HEADER_HEIGHT } from '../../constants'
import { PendingFocusHandle } from './usePendingFocus'
import ClippedPath from '../ClippedPath'
import styles from './OutputFileHeader.module.css'

interface Props {
  filename: string
  onChange: (name: string) => void
  firstPosition: number
  focus: PendingFocusHandle
  folder: string | null
  onPickFolder: () => void
  isDuplicate: boolean
}

export default function OutputFileHeader({
  filename, onChange, firstPosition, focus, folder, onPickFolder, isDuplicate,
}: Props) {
  const shouldFocus = focus.pendingFocus?.afterPosition === firstPosition - 1
  const cursorPos = focus.pendingFocus?.cursorPos ?? 0
  return (
    <div
      className={`${styles.header} ${isDuplicate ? styles.headerDuplicate : ''}`}
      style={{ margin: `4px ${ITEM_PADDING}px`, height: HEADER_HEIGHT - 8 }}
    >
      <div className={styles.nameRow}>
        <input
          ref={(el) => {
            if (el && shouldFocus) {
              el.focus()
              el.setSelectionRange(cursorPos, cursorPos)
              focus.clear()
            }
          }}
          type="text"
          value={filename}
          onChange={(e) => onChange(e.target.value)}
          placeholder="filename"
          className={`${styles.input} ${isDuplicate ? styles.inputDuplicate : ''}`}
        />
        <span className={styles.extension}>.pdf</span>
      </div>
      <ClippedPath path={folder} onClick={onPickFolder} />
    </div>
  )
}
