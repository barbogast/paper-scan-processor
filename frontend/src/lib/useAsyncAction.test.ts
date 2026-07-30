import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { notifications } from '@mantine/notifications'
import { useAsyncAction } from './useAsyncAction'

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useAsyncAction', () => {
  beforeEach(() => {
    vi.mocked(notifications.show).mockReset()
  })

  it('starts not pending', () => {
    const { result } = renderHook(() => useAsyncAction(async () => {}))
    expect(result.current.pending).toBe(false)
  })

  it('is pending while the action is in flight, and settles once it resolves', async () => {
    const d = deferred<void>()
    const { result } = renderHook(() => useAsyncAction(() => d.promise))

    act(() => result.current.run())
    expect(result.current.pending).toBe(true)

    await act(async () => { d.resolve(); await d.promise })
    expect(result.current.pending).toBe(false)
  })

  it('ignores a second call while the first is still in flight', async () => {
    const d = deferred<void>()
    const fn = vi.fn(() => d.promise)
    const { result } = renderHook(() => useAsyncAction(fn))

    act(() => { result.current.run(); result.current.run(); result.current.run() })
    expect(fn).toHaveBeenCalledTimes(1)

    await act(async () => { d.resolve(); await d.promise })
  })

  it('allows a new call once the previous one has settled', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAsyncAction(fn))

    await act(async () => result.current.run())
    await act(async () => result.current.run())
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('reports a rejection through the shared error handler with the given title, and still clears pending', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useAsyncAction(fn, 'Export failed'))

    act(() => result.current.run())
    await waitFor(() => expect(result.current.pending).toBe(false))

    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Export failed' }))
  })

  it('forwards arguments to the wrapped function', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAsyncAction((a: number, b: string) => fn(a, b)))

    await act(async () => result.current.run(1, 'x'))
    expect(fn).toHaveBeenCalledWith(1, 'x')
  })
})
