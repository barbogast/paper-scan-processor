import { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import ErrorBoundary from './ErrorBoundary'

function Boom(): never {
  throw new Error('render boom')
}

function renderWithProvider(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // React logs the caught error to console.error itself; silence it so
    // the expected test output doesn't look like a failure.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders children when nothing throws', () => {
    renderWithProvider(
      <ErrorBoundary>
        <div>fine</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('fine')).toBeTruthy()
  })

  it('shows a fallback with the error message and a collapsible stack trace when a child throws', () => {
    renderWithProvider(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('render boom')).toBeTruthy()
    expect(screen.getByText('Details')).toBeTruthy()
    expect(screen.getByText(/Error: render boom/)).toBeTruthy()
  })

  it('reloads the page when the Reload button is clicked', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    })

    renderWithProvider(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByText('Reload'))

    expect(reload).toHaveBeenCalled()
  })
})
