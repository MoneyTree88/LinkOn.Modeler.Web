export type ValidationIssue = {
  path: string
  message: string
  severity: 'error' | 'warn'
}

const REQUIRED_ATTRS = ['@_NM']

export function validateQmf(data: any): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const root = data?.Q ?? data
  if (!root) {
    issues.push({ path: 'Q', message: '루트 Q 요소가 없습니다.', severity: 'error' })
    return issues
  }

  const driver = root.DR
  if (!driver) {
    issues.push({ path: 'Q.DR', message: 'DR(Driver) 요소가 없습니다.', severity: 'error' })
    return issues
  }

  for (const attr of REQUIRED_ATTRS) {
    if (driver[attr] === undefined) {
      issues.push({ path: `Q.DR.${attr}`, message: `Driver 필수 속성 ${attr} 누락`, severity: 'error' })
    }
  }

  // 간단한 중복 검사: _S 시퀀스 ID
  const seqIds: Record<string, string> = {}
  collectSeq(driver, 'Q.DR', issues, seqIds)

   // --- Rule set from .NET ModelingValidation (핵심 요약 포팅) ---
  validatePlcTagLinks(driver, issues)
  validateCustomTagQueries(driver, issues)
  validateSchedule(driver, issues)

  return issues
}

function collectSeq(node: any, path: string, issues: ValidationIssue[], seqMap: Record<string, string>) {
  if (node == null || typeof node !== 'object') return

  if (Array.isArray(node)) {
    node.forEach((n, idx) => collectSeq(n, `${path}[${idx}]`, issues, seqMap))
    return
  }

  if (node['@__S'] !== undefined) {
    const key = String(node['@__S'])
    if (seqMap[key]) {
      issues.push({
        path,
        message: `중복 시퀀스 ID(_S)=${key} (이전: ${seqMap[key]})`,
        severity: 'warn',
      })
    } else {
      seqMap[key] = path
    }
  }

  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('@')) continue
    collectSeq(v, `${path}.${k}`, issues, seqMap)
  }
}

// Rule group: PlcTag link & address
function validatePlcTagLinks(driver: any, issues: ValidationIssue[]) {
  const plcTags = findNodes(driver, 'PTG')
  plcTags.forEach((tag, idx) => {
    const path = `Q.DR.PTG[${idx}]`
    const defineType = tag['@_DT']
    if (defineType === 'L') {
      if (!tag['@_LNK']) {
        issues.push({ path, message: 'link child 누락 (PlcTag DefineType=Link)', severity: 'error' })
      }
      if (!tag['@_VF']) {
        issues.push({ path, message: 'link plc tag value filter 누락', severity: 'error' })
      }
    } else if (defineType === undefined && !tag['@_NM']) {
      issues.push({ path, message: 'plc tag address 누락', severity: 'error' })
    }
  })
}

// Rule group: CustomTag SQL
function validateCustomTagQueries(driver: any, issues: ValidationIssue[]) {
  const sets = findNodes(driver, 'CTS')
  sets.forEach((ct, idx) => {
    const path = `Q.DR.CTS[${idx}]`
    const sql = ct?.SQ?.['@_Q'] || ''
    const cond = ct?.['@_LCD'] || ''
    if (!sql || !cond) return
    const lowerSql = String(sql).toLowerCase()
    const cols = extractSelectColumns(lowerSql)
    if (!cols) {
      issues.push({ path, message: 'query columns (empty)', severity: 'error' })
      return
    }
    if (cols.some((c) => c.includes('*'))) {
      issues.push({ path, message: "query columns (can't use '*')", severity: 'error' })
      return
    }
    const condCols = extractConditionColumns(String(cond).toLowerCase())
    condCols.forEach((c) => {
      if (!cols.some((col) => col === c || col.split('.')[1] === c)) {
        issues.push({
          path,
          message: `condition column(${c}) not found in query`,
          severity: 'error',
        })
      }
    })
  })
}

// Rule group: OperationFlow schedule
function validateSchedule(driver: any, issues: ValidationIssue[]) {
  const flows = findNodes(driver, 'OFO') // OperationFlow
  flows.forEach((f, idx) => {
    const base = `Q.DR.OFO[${idx}]`
    const trigMode = f['@_SM'] // ScheduleTriggerStartMode
    const trigType = f['@_ST'] // ScheduleTriggerType
    const interval = Number(f['@_SI'] ?? 0)
    const day = f['@_SD']
    const week = f['@_SW']
    const startTime = f['@_STT']

    if (trigMode === 'D' && empty(f['@_SDT'])) {
      issues.push({ path: base, message: 'start delay time 누락', severity: 'error' })
    } else if (trigMode === 'S' && empty(f['@_SST'])) {
      issues.push({ path: base, message: 'specific start time 누락', severity: 'error' })
    }

    if (trigType === 'I' && interval <= 0) {
      issues.push({ path: base, message: 'schedule interval <= 0', severity: 'error' })
    } else if (trigType === 'D') {
      if (interval <= 0) issues.push({ path: base, message: 'schedule day interval <= 0', severity: 'error' })
      if (empty(startTime)) issues.push({ path: base, message: 'per day start time 누락', severity: 'error' })
    } else if (trigType === 'W') {
      if (interval <= 0) issues.push({ path: base, message: 'schedule week interval <= 0', severity: 'error' })
      if (empty(day)) issues.push({ path: base, message: 'day of week 누락', severity: 'error' })
      if (empty(startTime)) issues.push({ path: base, message: 'per week start time 누락', severity: 'error' })
    } else if (trigType === 'M') {
      if (interval <= 0) issues.push({ path: base, message: 'schedule month interval <= 0', severity: 'error' })
      if (empty(day)) issues.push({ path: base, message: 'day of week 누락', severity: 'error' })
      if (f['@_SMM'] === 'W' && empty(week)) {
        issues.push({ path: base, message: 'week of month 누락', severity: 'error' })
      }
      if (empty(startTime)) issues.push({ path: base, message: 'per week start time 누락', severity: 'error' })
    }
  })
}

function empty(v: any) {
  return v === undefined || v === null || v === ''
}

function findNodes(node: any, tag: string): any[] {
  const out: any[] = []
  walk(node, (n) => {
    if (n && typeof n === 'object' && !Array.isArray(n) && n[tag]) {
      const child = n[tag]
      if (Array.isArray(child)) out.push(...child)
      else out.push(child)
    }
  })
  return out
}

function walk(node: any, fn: (n: any) => void) {
  if (node == null) return
  fn(node)
  if (Array.isArray(node)) {
    node.forEach((v) => walk(v, fn))
    return
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) {
      walk(v, fn)
    }
  }
}

function extractSelectColumns(sql: string): string[] | null {
  // 아주 단순한 파서: select ... from
  const m = /select\s+(.+?)\s+from/.exec(sql)
  if (!m) return null
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractConditionColumns(cond: string): string[] {
  // 조건 문자열을 단순 분리 (공백/연산자 기준)
  return cond
    .split(/[^a-zA-Z0-9_.]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
