import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import * as uploadQueue from './uploadQueue'
import { UploadJob } from './uploadQueue'
import { UploadFile } from '../../../wailsjs/go/main/App'

vi.mock('../../../wailsjs/go/main/App', () => ({
  UploadFile: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const jobA: UploadJob = { path: '/root/a.pdf', folderId: 'f1', name: 'a.pdf' }
const jobB: UploadJob = { path: '/root/b.pdf', folderId: 'f1', name: 'b.pdf' }
const jobC: UploadJob = { path: '/root/c.pdf', folderId: 'f1', name: 'c.pdf' }

describe('uploadQueue', () => {
  beforeEach(() => {
    vi.mocked(UploadFile).mockReset()
    uploadQueue.reset()
  })

  it('starts with no status for a file', () => {
    expect(uploadQueue.getStatus(jobA.path)).toBeUndefined()
  })

  it('runs jobs sequentially, one uploading at a time', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    vi.mocked(UploadFile).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    uploadQueue.start([jobA, jobB])

    expect(uploadQueue.getStatus(jobA.path)?.status).toBe('uploading')
    expect(uploadQueue.getStatus(jobB.path)?.status).toBe('queued')
    expect(UploadFile).toHaveBeenCalledTimes(1)

    first.resolve('id-a')
    await waitFor(() => expect(uploadQueue.getStatus(jobA.path)?.status).toBe('done'))
    await waitFor(() => expect(uploadQueue.getStatus(jobB.path)?.status).toBe('uploading'))
    expect(UploadFile).toHaveBeenCalledTimes(2)

    second.resolve('id-b')
    await waitFor(() => expect(uploadQueue.getStatus(jobB.path)?.status).toBe('done'))
  })

  it('marks a failed upload as error with a message', async () => {
    vi.mocked(UploadFile).mockRejectedValueOnce(new Error('quota exceeded'))

    uploadQueue.start([jobA])

    await waitFor(() => expect(uploadQueue.getStatus(jobA.path)?.status).toBe('error'))
    expect(uploadQueue.getStatus(jobA.path)?.error).toContain('quota exceeded')
  })

  it('retry re-queues just that file', async () => {
    vi.mocked(UploadFile).mockRejectedValueOnce(new Error('fail'))
    uploadQueue.start([jobA])
    await waitFor(() => expect(uploadQueue.getStatus(jobA.path)?.status).toBe('error'))

    vi.mocked(UploadFile).mockResolvedValueOnce('id-a')
    uploadQueue.retry(jobA)

    await waitFor(() => expect(uploadQueue.getStatus(jobA.path)?.status).toBe('done'))
    expect(UploadFile).toHaveBeenCalledTimes(2)
  })

  it('retry clears the previous error, even when passed the stale UploadEntry itself', async () => {
    vi.mocked(UploadFile).mockRejectedValueOnce(new Error('fail'))
    uploadQueue.start([jobA])
    await waitFor(() => expect(uploadQueue.getStatus(jobA.path)?.status).toBe('error'))

    // Realistic call site: a Retry button passes the UploadEntry it already has
    // from getStatus(), not a hand-trimmed UploadJob — it still carries the old
    // status/error fields, which retry() must not let leak into the requeue.
    const staleEntry = uploadQueue.getStatus(jobA.path)!

    // Keep the worker busy on jobB so jobA's requeue is left sitting in
    // 'queued' rather than immediately promoted to 'uploading' (which would
    // clear .error on its own and hide the bug this test is checking for).
    const busy = deferred<string>()
    vi.mocked(UploadFile).mockReturnValueOnce(busy.promise)
    uploadQueue.start([jobB])
    uploadQueue.retry(staleEntry)

    expect(uploadQueue.getStatus(jobA.path)?.status).toBe('queued')
    expect(uploadQueue.getStatus(jobA.path)?.error).toBeUndefined()

    // Let the queue drain so it doesn't leave a dangling promise behind
    // (mockReset() in the next beforeEach can't unstick an in-flight loop).
    busy.resolve('id-b')
    await waitFor(() => expect(uploadQueue.getStatus(jobA.path)?.status).toBe('done'))
  })

  it('cancelRemaining stops starting new files and reverts queued files to idle', async () => {
    const first = deferred<string>()
    vi.mocked(UploadFile).mockReturnValueOnce(first.promise)

    uploadQueue.start([jobA, jobB])
    expect(uploadQueue.getStatus(jobA.path)?.status).toBe('uploading')

    uploadQueue.cancelRemaining()
    expect(uploadQueue.getStatus(jobB.path)?.status).toBe('idle')

    first.resolve('id-a')
    await waitFor(() => expect(uploadQueue.getStatus(jobA.path)?.status).toBe('done'))
    expect(UploadFile).toHaveBeenCalledTimes(1)
  })

  it('reset clears all statuses and ignores a stale in-flight resolution', async () => {
    const first = deferred<string>()
    vi.mocked(UploadFile).mockReturnValueOnce(first.promise)

    uploadQueue.start([jobA])
    expect(uploadQueue.getStatus(jobA.path)?.status).toBe('uploading')

    uploadQueue.reset()
    expect(uploadQueue.getStatus(jobA.path)).toBeUndefined()

    first.resolve('id-a')
    await new Promise(r => setTimeout(r, 0))
    expect(uploadQueue.getStatus(jobA.path)).toBeUndefined()
  })

  it('reset lets a new run start immediately behind an abandoned in-flight request', async () => {
    const stuck = deferred<string>()
    vi.mocked(UploadFile).mockReturnValueOnce(stuck.promise)
    uploadQueue.start([jobA])
    expect(uploadQueue.getStatus(jobA.path)?.status).toBe('uploading')

    uploadQueue.reset()

    const second = deferred<string>()
    vi.mocked(UploadFile).mockReturnValueOnce(second.promise)
    uploadQueue.start([jobB])
    // Not blocked behind jobA's still-pending request.
    expect(uploadQueue.getStatus(jobB.path)?.status).toBe('uploading')

    // The abandoned jobA request finally settles — its cleanup must not
    // clobber the new run's in-progress state.
    stuck.resolve('id-a')
    await new Promise(r => setTimeout(r, 0))
    expect(uploadQueue.getStatus(jobB.path)?.status).toBe('uploading')

    // If the stale settle had wrongly cleared `running`, this would jump
    // straight to 'uploading' instead of waiting its turn behind jobB.
    const third = deferred<string>()
    vi.mocked(UploadFile).mockReturnValueOnce(third.promise)
    uploadQueue.start([jobC])
    expect(uploadQueue.getStatus(jobC.path)?.status).toBe('queued')

    second.resolve('id-b')
    await waitFor(() => expect(uploadQueue.getStatus(jobC.path)?.status).toBe('uploading'))

    third.resolve('id-c')
    await waitFor(() => expect(uploadQueue.getStatus(jobC.path)?.status).toBe('done'))
  })
})
