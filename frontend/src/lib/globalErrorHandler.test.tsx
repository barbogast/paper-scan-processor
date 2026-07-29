import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { notifications } from '@mantine/notifications'
import { handleUnexpectedError, installGlobalErrorHandler } from './globalErrorHandler'

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

function lastNotification() {
  const calls = vi.mocked(notifications.show).mock.calls
  return calls[calls.length - 1][0]
}

describe('installGlobalErrorHandler', () => {
  beforeEach(() => {
    vi.mocked(notifications.show).mockReset()
    installGlobalErrorHandler()
  })

  it('shows a persistent notification with a collapsible stack trace for an unhandled promise rejection', () => {
    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new Error('boom') })
    )

    const shown = lastNotification()
    expect(shown.title).toBe('An unexpected error occurred')
    expect(shown.color).toBe('red')
    expect(shown.autoClose).toBe(false)

    render(<>{shown.message}</>)
    expect(screen.getByText('boom')).toBeTruthy()
    expect(screen.getByText('Details')).toBeTruthy()
    expect(screen.getByText(/Error: boom/)).toBeTruthy()
  })

  it('shows a notification for an uncaught exception', () => {
    window.dispatchEvent(Object.assign(new Event('error'), { error: new Error('kaboom') }))

    render(<>{lastNotification().message}</>)
    expect(screen.getByText('kaboom')).toBeTruthy()
  })

  it('omits the details section when there is no stack (a non-Error rejection reason)', () => {
    window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'plain string reason' }))

    render(<>{lastNotification().message}</>)
    expect(screen.getByText('plain string reason')).toBeTruthy()
    expect(screen.queryByText('Details')).toBeNull()
  })
})

describe('handleUnexpectedError', () => {
  beforeEach(() => {
    vi.mocked(notifications.show).mockReset()
  })

  it('defaults to the generic title', () => {
    handleUnexpectedError(new Error('boom'))
    expect(lastNotification().title).toBe('An unexpected error occurred')
  })

  it('uses a call-site-provided title when given one', () => {
    handleUnexpectedError(new Error('boom'), 'Export failed')
    expect(lastNotification().title).toBe('Export failed')
  })
})
