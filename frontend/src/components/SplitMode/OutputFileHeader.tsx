import { ITEM_PADDING, HEADER_HEIGHT } from '../../constants'

export interface PendingFocusHandle {
  pendingFocus: { afterPage: number; cursorPos: number } | null
  clear: () => void
}

interface Props {
  filename: string
  onChange: (name: string) => void
  firstPage: number
  focus: PendingFocusHandle
  folder: string | null
  onPickFolder: () => void
  isDuplicate: boolean
}

export default function OutputFileHeader({
  filename, onChange, firstPage, focus, folder, onPickFolder, isDuplicate,
}: Props) {
  const shouldFocus = focus.pendingFocus?.afterPage === firstPage - 1
  const cursorPos = focus.pendingFocus?.cursorPos ?? 0
  return (
    <div
      style={{
        margin: `4px ${ITEM_PADDING}px`,
        height: HEADER_HEIGHT - 8,
        padding: '4px 6px',
        background: 'var(--mantine-color-white)',
        border: `1px solid ${isDuplicate ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-gray-3)'}`,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12,
            fontWeight: 500,
            color: isDuplicate ? 'var(--mantine-color-red-7)' : 'inherit',
            minWidth: 0,
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--mantine-color-dimmed)', flexShrink: 0 }}>.pdf</span>
      </div>
      <div
        onClick={onPickFolder}
        style={{
          fontSize: 11,
          color: folder ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-dimmed)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {folder ?? 'Choose folder…'}
      </div>
    </div>
  )
}
