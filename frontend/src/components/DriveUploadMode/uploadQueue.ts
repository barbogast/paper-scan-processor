import { useEffect, useState } from 'react'
import { UploadFile } from '../../../wailsjs/go/main/App'

export type UploadStatus = 'idle' | 'queued' | 'uploading' | 'done' | 'error'

export interface UploadJob {
  path: string
  folderId: string
  name: string
}

export interface UploadEntry extends UploadJob {
  status: UploadStatus
  error?: string
}

// Per-file upload status, driven by a sequential (concurrency = 1) worker.
// A module-level singleton (like ../../lib/pageCache) rather than a hook:
// there is only ever one upload run in flight for the app, so the queue's
// lifetime doesn't need to be tied to any one component instance. Callers
// resolve each file's destination folder/name up front and pass in an
// ordered list of jobs — this module only knows how to run them one at a
// time and track status, not about the file tree or Drive assignments.
const filesByPath = new Map<string, UploadEntry>()
let pendingPaths: string[] = []
const listeners = new Set<() => void>()
let running = false
let cancelled = false

function notify() {
  for (const fn of listeners) fn()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useUploadQueueRender() {
  const [, setTick] = useState(0)
  useEffect(() => subscribe(() => setTick(t => t + 1)), [])
}

export function getStatus(path: string): UploadEntry | undefined {
  return filesByPath.get(path)
}

function updateStatus(path: string, status: UploadStatus, error?: string) {
  const existing = filesByPath.get(path)!
  filesByPath.set(path, { ...existing, status, error })
  notify()
}

async function runQueue() {
  if (running) return
  running = true
  while (!cancelled && pendingPaths.length > 0) {
    const path = pendingPaths.shift()!
    const job = filesByPath.get(path)!
    updateStatus(path, 'uploading')
    try {
      await UploadFile(job.path, job.folderId, job.name)
      updateStatus(path, 'done')
    } catch (e) {
      updateStatus(path, 'error', String(e))
    }
  }
  running = false
}

function enqueue(newJobs: UploadJob[]) {
  if (newJobs.length === 0) return
  cancelled = false
  for (const job of newJobs) {
    filesByPath.set(job.path, { ...job, status: 'queued', error: undefined })
    pendingPaths.push(job.path)
  }
  notify()
  void runQueue()
}

export function start(newJobs: UploadJob[]): void {
  enqueue(newJobs)
}

export function retry(job: UploadJob): void {
  enqueue([job])
}

// Stops starting new files; does not abort an in-flight request. Files
// still waiting their turn go back to idle since they were never attempted.
export function cancelRemaining(): void {
  cancelled = true
  for (const path of pendingPaths) updateStatus(path, 'idle')
  pendingPaths = []
}

// Callers must only invoke this once the queue is idle (nothing queued or
// uploading) — in the UI, that's guaranteed by the upload modal staying
// open and blocking the root-folder picker until every file reaches a
// terminal state. If that ever stops holding, a request from the discarded
// run could still be in flight and would resurface after this call.
export function reset(): void {
  cancelled = false
  running = false
  filesByPath.clear()
  pendingPaths = []
  notify()
}
