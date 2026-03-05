import { XMLBuilder, XMLParser } from 'fast-xml-parser'

const PC_SEP = String.fromCharCode(0x1e) // precondition separator

// Shared parser/builder options to keep QMF attribute names intact.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: false,
  // Do not auto convert values (e.g., "01" should stay string)
  parseTagValue: false,
  parseAttributeValue: false,
})

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  suppressEmptyNode: true,
  format: true,
  indentBy: '  ',
})

export type QmfDocument = {
  rawXml: string
  data: any
}

export function parseQmf(xml: string): QmfDocument {
  const normalized = decodeControlSeparators(xml)
  const data = parser.parse(normalized)
  return { rawXml: xml, data }
}

export function buildQmf(data: any): string {
  const raw = builder.build(data)
  return encodeControlSeparators(raw)
}

export function getDriverSummary(data: any) {
  // Q -> DR is the common shape. Use optional chaining to stay robust.
  const driver = data?.Q?.DR ?? data?.DR ?? data
  const name = driver?.['@_NM'] ?? driver?.NM ?? 'Unknown'
  const version = driver?.['@__VER'] ?? driver?._VER ?? ''

  // Count messages by scanning the tree for MG nodes (Message)
  const countMessages = countTag(driver, 'MG')

  // Flows: Q/DR/FLW/CTR/OFL/OFO 구조 -> OFO 개수를 세는 것이 실제 플로우 건수와 동일
  const countFlows = countTag(driver, 'OFO')

  // Value sets remain as before
  const valueSets = driver?.DCL?.VSD?.VSL
  const countValueSets = Array.isArray(valueSets) ? valueSets.length : valueSets ? 1 : 0

  return {
    name,
    version,
    countMessages,
    countFlows,
    countValueSets,
  }
}

function countTag(root: any, tag: string) {
  if (!root) return 0
  let count = 0
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    for (const [k, v] of Object.entries(node)) {
      if (k === tag) count += Array.isArray(v) ? v.length : 1
      if (Array.isArray(v)) v.forEach((item) => stack.push(item))
      else stack.push(v)
    }
  }
  return count
}

// Replace encoded control references (&#x1E; / &#30;) with the actual separator char
// so parsing/PropertyGrid logic can split reliably.
function decodeControlSeparators(xml: string) {
  return xml.replace(/&#x1e;|&#30;/gi, PC_SEP)
}

// Before persisting, re-encode the separator to avoid invalid XML control characters.
function encodeControlSeparators(xml: string) {
  const re = new RegExp(PC_SEP, 'g')
  return xml.replace(re, '&#x1E;')
}
