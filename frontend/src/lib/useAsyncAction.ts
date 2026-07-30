import { useRef, useState } from 'react'
import { handleUnexpectedError } from './globalErrorHandler'

export interface AsyncActionHandle<Args extends unknown[]> {
  run: (...args: Args) => void
  pending: boolean
}

// Wraps an async action (an RPC call, typically) so a trigger can't fire it
// again while a previous invocation from the same instance is still in
// flight, and so failures always surface through the same notification path
// instead of each call site catching (or forgetting to catch) errors on its
// own. `fn` is responsible for any state it wants to update on success; this
// hook only tracks whether it's in flight and reports failure.
export function useAsyncAction<Args extends unknown[]>(
  fn: (...args: Args) => Promise<void>,
  errorTitle?: string,
): AsyncActionHandle<Args> {
  const [pending, setPending] = useState(false)
  // Mirrors `pending` but reads synchronously, so a second call arriving
  // before React re-renders (state updates are batched) is still rejected.
  const pendingRef = useRef(false)

  const run = (...args: Args) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    fn(...args)
      .catch(e => handleUnexpectedError(e, errorTitle))
      .finally(() => {
        pendingRef.current = false
        setPending(false)
      })
  }

  return { run, pending }
}
