export interface LocalFile {
  path: string
  name: string
  sizeBytes: number
  isPdf: boolean
  pageCount: number
  corrupt: boolean
}

export interface LocalFileGroup {
  name: string
  files: LocalFile[]
  subgroups: LocalFileGroup[]
  // Root-relative identifier used to look up this group's selection,
  // inclusion, and Drive-assignment state: subfolder names joined by '/'
  // down from the scan root (e.g. "invoices/2026"). Assigned once, right
  // after a scan, by useFileTree — null only for the invisible scan root
  // itself, which is never a lookup target.
  key: string | null
}

export interface DriveAssignment {
  driveFolderId: string
  path: string
}

export type SelectionItem = { type: 'file'; path: string } | { type: 'group'; key: string }
