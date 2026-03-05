export function arrayify<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

export type FoundNode = { node: any; path: string }

export function findNodes(root: any, tagName: string): FoundNode[] {
  const results: FoundNode[] = []

  function walk(node: any, path: string) {
    if (node == null) return
    if (Array.isArray(node)) {
      node.forEach((n, idx) => walk(n, `${path}[${idx}]`))
      return
    }
    if (typeof node !== 'object') return

    for (const [k, v] of Object.entries(node)) {
      const nextPath = path ? `${path}.${k}` : k
      if (k === tagName) {
        if (Array.isArray(v)) {
          v.forEach((item, idx) => results.push({ node: item, path: `${nextPath}[${idx}]` }))
        } else {
          results.push({ node: v, path: nextPath })
        }
      }
      walk(v, nextPath)
    }
  }

  walk(root, '')
  return results
}

export function updateNodeBySeq(root: any, seqId: string, mutator: (node: any) => void): boolean {
  let updated = false
  function walk(node: any) {
    if (updated || node == null) return
    if (Array.isArray(node)) {
      for (const n of node) {
        walk(n)
        if (updated) return
      }
      return
    }
    if (typeof node !== 'object') return
    if (String(node['@__S'] ?? '') === seqId) {
      mutator(node)
      updated = true
      return
    }
    for (const v of Object.values(node)) {
      walk(v)
      if (updated) return
    }
  }
  walk(root)
  return updated
}

export function updateNodeByPath(root: any, path: Path, mutator: (node: any) => void): boolean {
  const target = getNodeByPath(root, path)
  if (!target) return false
  mutator(target)
  return true
}

export function getNodeByPath(root: any, path: Path): any {
  let cur = root
  for (let i = 0; i < path.length; i += 2) {
    const tag = path[i]
    const idx = path[i + 1]
    if (!cur || typeof cur !== 'object') return null
    const arr = arrayify(cur[tag as any])
    cur = arr[idx as number]
  }
  return cur
}

export type Path = (string | number)[]
