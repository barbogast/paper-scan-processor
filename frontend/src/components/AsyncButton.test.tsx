import { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import AsyncButton from './AsyncButton'

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

function renderWithProvider(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

describe('AsyncButton', () => {
  beforeEach(() => {
    vi.mocked(notifications.show).mockReset()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn().mockResolvedValue(undefined)
    renderWithProvider(<AsyncButton onClick={onClick}>Go</AsyncButton>)

    fireEvent.click(screen.getByText('Go'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disables itself while the action is in flight and re-enables once it settles', async () => {
    const d = deferred<void>()
    const onClick = vi.fn(() => d.promise)
    renderWithProvider(<AsyncButton onClick={onClick}>Go</AsyncButton>)

    const button = screen.getByText('Go').closest('button')!
    fireEvent.click(button)
    expect(button.disabled).toBe(true)

    d.resolve()
    await waitFor(() => expect(button.disabled).toBe(false))
  })

  it('ignores extra clicks while the first invocation is still in flight', async () => {
    const d = deferred<void>()
    const onClick = vi.fn(() => d.promise)
    renderWithProvider(<AsyncButton onClick={onClick}>Go</AsyncButton>)

    const button = screen.getByText('Go').closest('button')!
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)

    d.resolve()
    await waitFor(() => expect(button.disabled).toBe(false))
  })

  it('respects an externally passed disabled prop even when not pending', () => {
    const onClick = vi.fn().mockResolvedValue(undefined)
    renderWithProvider(<AsyncButton onClick={onClick} disabled>Go</AsyncButton>)

    expect(screen.getByText('Go').closest('button')!.disabled).toBe(true)
  })

  it('reports a rejection with the given title', async () => {
    const onClick = vi.fn().mockRejectedValue(new Error('boom'))
    renderWithProvider(<AsyncButton onClick={onClick} errorTitle="Export failed">Go</AsyncButton>)

    fireEvent.click(screen.getByText('Go'))
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Export failed' })
    ))
  })
})
