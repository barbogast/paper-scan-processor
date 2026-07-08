// Drag-to-resize logic shared by panels with a draggable width: given the
// current width and a setter (local `useState` or a lifted `onChange`),
// returns a mousedown handler to wire up to the drag handle.
export function makeResizeDragHandler(width: number, onWidthChange: (w: number) => void, min: number, max: number) {
  return (e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = width
    const clamp = (w: number) => Math.max(min, Math.min(max, w))
    const stop = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    const onMove = (ev: MouseEvent) => {
      // If the button was released outside the window, no mouseup reaches us —
      // ev.buttons reports the current state regardless, so treat that as drag-end
      // instead of leaving the panel resizing on every later mouse movement.
      if (ev.buttons === 0) { stop(); return }
      onWidthChange(clamp(startWidth + ev.clientX - startX))
    }
    const onUp = (ev: MouseEvent) => {
      onWidthChange(clamp(startWidth + ev.clientX - startX))
      stop()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }
}
