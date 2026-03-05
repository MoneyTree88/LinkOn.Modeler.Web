import { QmfSchema } from '../generated/schema'

// Build a mapping: tag -> attribute codes (Atr* values)
const tagAttrMap: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  Object.values(QmfSchema).forEach((entry: any) => {
    const elements = entry.elements || {}
    const attrs = entry.attributes || {}
    const attrVals = Object.values(attrs) as string[]
    Object.values(elements).forEach((tag: any) => {
      const key = String(tag)
      if (!map[key]) map[key] = []
      map[key].push(...attrVals)
    })
  })
  // remove duplicates
  Object.keys(map).forEach((k) => {
    map[k] = Array.from(new Set(map[k]))
  })
  return map
})()

export function getAttributesForTag(tag: string): string[] {
  return tagAttrMap[tag] ?? []
}
