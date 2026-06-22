export function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}

export function ellipsisPath(p: string) {
  return '…/' + (p.split(/[\\/]/).pop() ?? p)
}
