import { notifications } from '@mantine/notifications'

// Backstop for errors that reach the top uncaught: a call site that forgot a
// .catch, or a rejection with no feature-specific handling. Shows a
// persistent notification so a failure is never silent, without attempting
// any recovery since the cause is by definition unhandled. title lets call
// sites that know which operation failed say so, while still sharing the
// same message/stack-trace formatting and notification behavior.
export function handleUnexpectedError(error: unknown, title = 'An unexpected error occurred') {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  notifications.show({
    title,
    message: (
      <>
        {message}
        {stack && (
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer' }}>Details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, margin: 0 }}>{stack}</pre>
          </details>
        )}
      </>
    ),
    color: 'red',
    autoClose: false,
  })
}

export function handlePromiseRejection(title: string) {
  return (error: unknown) => handleUnexpectedError(error, title)
}

export function installGlobalErrorHandler() {
  window.addEventListener('error', event => {
    handleUnexpectedError(event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', event => {
    handleUnexpectedError(event.reason)
  })
}
