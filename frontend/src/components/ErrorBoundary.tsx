import { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Button, Stack, Text } from '@mantine/core'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Catches render-time exceptions anywhere below it and shows a generic
// fallback instead of leaving a blank/frozen screen. This is the render-time
// counterpart to globalErrorHandler.ts, which covers everything else
// (uncaught exceptions outside render, unhandled rejections).
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: 'var(--mantine-spacing-xl)',
          textAlign: 'center',
        }}
      >
        <Stack align="center" gap="sm" style={{ maxWidth: 600 }}>
          <Text fw={600} size="lg">Something went wrong</Text>
          <Text size="sm" c="dimmed">{error.message}</Text>
          {error.stack && (
            <details style={{ marginTop: 8, textAlign: 'left', width: '100%' }}>
              <summary style={{ cursor: 'pointer' }}>Details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{error.stack}</pre>
            </details>
          )}
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Stack>
      </Box>
    )
  }
}
