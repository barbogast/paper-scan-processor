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
}

export interface DriveAssignment {
  driveFolderId: string
  path: string
}

export type SelectionItem = { type: 'file'; path: string } | { type: 'group'; key: string }
