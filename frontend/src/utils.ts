export function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p
}
