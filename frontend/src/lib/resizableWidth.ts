// Drag-to-resize logic shared by panels with a draggable width: given the
// current width and a setter (local `useState` or a lifted `onChange`),
// returns a mousedown handler to wire up to the drag handle.
export function makeResizeDragHandler(width: number, onWidthChange: (w: number) => void, min: number, max: number) {
  return (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = width
    const clamp = (w: number) => Math.max(min, Math.min(max, w))
    const onMove = (ev: MouseEvent) => onWidthChange(clamp(startWidth + ev.clientX - startX))
    const onUp = (ev: MouseEvent) => {
      onWidthChange(clamp(startWidth + ev.clientX - startX))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }
}
