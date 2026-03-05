import { arrayify, type Path } from './utils'

type FlowRefRecord = {
  tag: string
  node: any
}

export type FlowTextContext = {
  byRefKey: Map<string, FlowRefRecord>
  bySeqId: Map<string, FlowRefRecord>
}

type Resolved = {
  name: string
  found: boolean
}

const ASCII_LIKE_FORMATS = new Set(['A', 'J8', 'A2', 'C'])

const OPERATION_EXP: Record<string, string> = {
  E: '==',
  NE: '!=',
  M: '>',
  ME: '>=',
  L: '<',
  LE: '<=',
  CT: 'Contain(',
  SW: 'StartWith(',
}

const EVENT_ID_NAME: Record<string, string> = {
  C: 'ConnectorDataMessageReceived',
  R: 'ConnectorDataMessageRead',
  S: 'ConnectorDataMessageSent',
  W: 'ConnectorDataMessageWritten',
  P: 'ConnectorPlcTagValueChanged',
  F: 'CustomTagSetCreated',
  CE: 'CustomTagProcessCompleted',
  S1: 'GEM_S6F11',
  S2: 'GEM_S5F1',
  S3: 'GEM_S6F1',
  S4: 'GEM_S2F14',
  CR: 'CustomEventRaised',
  N: 'None',
}

const EVENT_OPERAND_TYPE: Record<string, string> = {
  MN: 'MessageName',
  MC: 'MessageCommand',
  MS: 'MessageStream',
  MF: 'MessageFunction',
  MV: 'MessageVersion',
  AG: 'Argument',
  SV: 'StaticVariable',
  ER: 'EventResultCode',
  TR: 'CustomTagEventResultCode',
  IN: 'ItemName',
}

const DS_ACTION: Record<string, string> = {
  C: 'Create',
  U: 'Update',
  R: 'Remove',
  E: 'Clear',
  S: 'Select',
}

export function buildFlowTextContext(driver: any): FlowTextContext {
  const byRefKey = new Map<string, FlowRefRecord>()
  const bySeqId = new Map<string, FlowRefRecord>()

  const walk = (node: any, tag: string) => {
    if (!node || typeof node !== 'object') return

    const refKey = readAttr(node, '_RK')
    if (refKey && !byRefKey.has(refKey)) byRefKey.set(refKey, { tag, node })

    const seq = readAttr(node, '_S')
    if (seq && !bySeqId.has(seq)) bySeqId.set(seq, { tag, node })

    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('@')) continue
      arrayify(value).forEach((child) => {
        if (child && typeof child === 'object') walk(child, key)
      })
    }
  }

  walk(driver, 'DRV')
  return { byRefKey, bySeqId }
}

export function buildFlowObjectText(tag: string, node: any, ctx: FlowTextContext, path: Path): string {
  switch (tag) {
    case 'DRV':
      return withDesc(`${readAttr(node, 'NM', 'Driver')} Eap=[${readAttr(node, 'EN')}]`, node)
    case 'CTR':
      return simple(node, 'Controller')
    case 'OFL':
      return simple(node, 'OperationFlowList')
    case 'OFO':
      return simple(node, 'OperationFlow')
    case 'ATH': {
      const count = countDirectChildren(node)
      let info = readAttr(node, 'NM', 'AutoTraceHandler')
      if (count > 0) info += ` Length=[${count}]`
      return withDesc(info, node)
    }
    case 'ATA': {
      let info = `${readAttr(node, 'NM', 'TraceMessageAdapter')} Action=[${traceActionName(readAttr(node, 'A01', 'S'))}]`
      const c = resolve(node, ctx, ['_RKC'], ['DI']).name
      const s = resolve(node, ctx, ['_RKS'], ['SI']).name
      const m = resolve(node, ctx, ['_RKM'], ['MI']).name
      if (m) info += ` Msg.=[${c}/${s}/${m}]`
      return withDesc(info, node)
    }
    case 'BPS':
      return simple(node, 'ByPass')
    case 'BPA': {
      let info = readAttr(node, 'NM', 'ByPassAdapter')
      const s = resolve(node, ctx, ['_RKS'], ['SI']).name
      if (s) info += ` Msg.=[${resolve(node, ctx, ['_RKC'], ['DI']).name} / ${s}]`
      return withDesc(info, node)
    }
    case 'CMT':
      return simple(node, 'Comment')
    case 'DSH': {
      let info = readAttr(node, 'NM', 'DataStoreSetter')
      info += ` Action=[${dataStoreActionName(readAttr(node, 'A', 'S'))}]`
      info += ` Mode=[${dataStoreModeName(readAttr(node, 'M', 'A'))}]`
      info += ` Scope=[${dataStoreLifeScopeName(readAttr(node, 'LS', 'A'))}]`
      const ds = resolve(node, ctx, ['_RRI'], ['RI']).name
      if (ds) info += ` Ds.=[${ds}]`
      return withDesc(info, node)
    }
    case 'EDL':
      return withDesc(`${readAttr(node, 'NM', 'ExternalDataLoader')} Type=[${externalDataTypeName(readAttr(node, 'PT', 'N'))}]`, node)
    case 'EDS':
      return withDesc(`${readAttr(node, 'NM', 'ExternalDataSetter')} Type=[${externalDataTypeName(readAttr(node, 'PT', 'N'))}]`, node)
    case 'EFE':
      return simple(node, 'ExternalFlowExecuter')
    case 'FDL':
      return withDesc(`${readAttr(node, 'NM', 'FtpDownloader')} Ftp.=[${readAttr(node, 'FP')}]`, node)
    case 'FUL':
      return withDesc(`${readAttr(node, 'NM', 'FtpUploader')} Ftp.=[${readAttr(node, 'FP')}]`, node)
    case 'GMH':
      return sessionPairText(node, ctx, 'GEMHandler', 'GEM.')
    case 'STH':
      return sessionPairText(node, ctx, 'SECSTraceHandler', 'GEM.')
    case 'GTO': {
      let info = readAttr(node, 'NM', 'Goto')
      const target = resolve(node, ctx, ['_RGT'], ['L']).name
      if (target) info += ` Loc.=[${target}]`
      return withDesc(info, node)
    }
    case 'GTL':
      return simple(node, 'GotoLabel')
    case 'LKH': {
      let info = readAttr(node, 'NM', 'LinkerSetter')
      const linkerSet = resolve(node, ctx, ['_RKL'], ['_LS']).name
      if (linkerSet) info += ` Lns.=[${linkerSet}]`
      return withDesc(info, node)
    }
    case 'LGH': {
      const command = logCommandName(readAttr(node, 'CD', 'N'))
      return `${readAttr(node, 'NM', 'LogHandler')} Command=[${command}] Parameters=[${readAttr(node, 'PV')}] Desc=[${readAttr(node, 'D')}]`
    }
    case 'PCH': {
      let info = readAttr(node, 'NM', 'PlugInCommandHandler')
      const connector = resolve(node, ctx, ['_RKC'], ['DI']).name
      if (connector) info += ` Connector.=[${connector}]`
      return withDesc(info, node)
    }
    case 'SLP':
      return withDesc(`${readAttr(node, 'NM', 'Sleep')} SleepTime=[${intAttr(node, 'PT', 1000)}]`, node)
    case 'SAP': {
      let info = readAttr(node, 'NM', 'SqlAppender')
      let query = resolve(node, ctx, ['_RKQ'], ['Q1']).name
      if (!query) {
        const sqy = firstChild(node, 'SQY')
        if (sqy) query = readAttr(sqy, 'NM')
      }
      if (query) {
        info += ` Query=[${query}]`
        info += ` ExecuteType=[${sqlExecuteTypeName(readAttr(node, 'Q2', 'N'))}]`
        info += ` TableName=[${readAttr(node, 'Q3')}]`
      }
      return withDesc(info, node)
    }
    case 'SDA': {
      let info = `${readAttr(node, 'NM', 'SqlDataAdapter')} To=[${dataAdapterToName(readAttr(node, 'TO', 'L'))}] From Table=[${readAttr(node, 'TN')}]`
      if (!isTrue(readAttr(node, 'GN', 'F'))) {
        const lns = resolve(node, ctx, ['_RKL'], ['_LS']).name
        if (lns) info += ` Lns.=[${lns}]`
      }
      return withDesc(info, node)
    }
    case 'SEC': {
      let info = readAttr(node, 'NM', 'SqlExecuter')
      const sqlConnector = resolve(node, ctx, ['_RSC'], [], ['B00', '_SN']).name
      if (sqlConnector) info += ` SqlConnector=[${sqlConnector}] ExecuteType=[${sqlExecuteTypeName(readAttr(node, 'B04', 'N'))}]`
      return withDesc(info, node)
    }
    case 'SVE': {
      let info = readAttr(node, 'NM', 'StaticValueExecuter')
      const setName = resolve(node, ctx, ['_RVS'], ['AI']).name
      if (setName) info += ` StaticVariableSet=[${setName}]`
      return withDesc(info, node)
    }
    case 'CCH':
      return gotoFlowText(node, ctx, 'CalculationHandler')
    case 'CCT':
      return simple(node, 'Calculator')
    case 'CCF':
      return decisionFormulaText(node, ctx, path, { fallback: 'CalculatorConditionFormula', formatAttr: 'F', withVr: false, operandFallback: ['OI'] })
    case 'DCS':
      return gotoFlowText(node, ctx, 'Decision')
    case 'DSC': {
      let info = readAttr(node, 'NM', 'DecisionCondition')
      const lns = resolve(node, ctx, ['_RKL'], ['_LS']).name
      if (lns) info += ` Lns.=[${lns}]`
      return withDesc(info, node)
    }
    case 'DSF':
      return decisionFormulaText(node, ctx, path, { fallback: 'DecisionFormula', formatAttr: 'OF', withVr: true, operandFallback: ['ON'] })
    case 'DDS':
      return simple(node, 'DynamicDecision')
    case 'DDC':
      return simple(node, 'DynamicDecisionCondition')
    case 'DDF':
      return decisionFormulaText(node, ctx, path, { fallback: 'DynamicDecisionFormula', formatAttr: 'F', withVr: false, operandFallback: ['OI'] })
    case 'ELN':
      return simple(node, 'EventListener')
    case 'EC': {
      let info = readAttr(node, 'NM', 'EventListenerCondition')
      const eventId = readAttr(node, 'EI', 'N').toUpperCase()
      const eventName = EVENT_ID_NAME[eventId] || 'None'
      if (eventId === 'CR') {
        info += ` Event.=[${eventName}]`
      } else {
        const s = resolve(node, ctx, ['_RKS'], ['SI']).name
        if (s) info += ` Event.=[${resolve(node, ctx, ['_RKC'], ['DI']).name}/${s}/${eventName}]`
      }
      return withDesc(info, node)
    }
    case 'ECF':
      return eventListenerFormulaText(node, path)
    case 'FNH':
      return simple(node, 'FunctionSetter')
    case 'FUN': {
      let info = readAttr(node, 'NM', 'Function')
      const fn = readAttr(node, 'FN')
      if (fn) info += ` Function=[${fn}] ErrorAction=[${errorActionName(readAttr(node, 'EA', 'I'))}]`
      return withDesc(info, node)
    }
    case 'MSD':
      return simple(node, 'MailSender')
    case 'MSA': {
      const pattern = patternName(readAttr(node, 'E0', 'F'))
      let info = `${readAttr(node, 'NM', 'MailSenderAdapter')} Pattern=[${pattern}]`
      if (pattern === 'Flexible') info += ` Ds=[${flowDataSourceName(readAttr(node, 'E10', 'L'))}]`
      return withDesc(info, node)
    }
    case 'PET':
      return simple(node, 'PlcEventTrigger')
    case 'PCN':
      return sessionPairText(node, ctx, 'PlcEventTriggerCondition', 'Ssn.')
    case 'PCF':
      return plcFormulaText(node, ctx, path)
    case 'RCV':
      return simple(node, 'Receiver')
    case 'RCN':
      return receiverConditionText(node, ctx)
    case 'RCF':
      return receiverFormulaText(node, ctx, path)
    case 'SND': {
      let info = ''
      if (['A1', 'A2', 'A3', 'A4'].some((k) => isTrue(readAttr(node, k, 'F')))) info += '[aa.] '
      if (isTrue(readAttr(node, 'CU', 'F'))) info += '[ac.] '
      info += readAttr(node, 'NM', 'Sender')
      return withDesc(info, node)
    }
    case 'SNM': {
      const action = readAttr(node, 'AT', 'S').toUpperCase()
      const c = resolve(node, ctx, ['_RKC'], ['DI']).name
      const s = resolve(node, ctx, ['_RKS'], ['SI']).name
      const m = resolve(node, ctx, ['_RKM'], ['MI'], ['MN']).name
      let info = readAttr(node, 'NM', 'MessageAdapter')
      if (action === 'S') {
        if (m) info += ` Msg.=[${c}/${s}/${m}]`
      } else if (s) {
        info += ` ByPass.=[${c}/${s}]`
      }
      return withDesc(info, node)
    }
    case 'SJG': {
      let info = readAttr(node, 'NM', 'SpecJudge')
      const target = resolve(node, ctx, ['_EGT'], ['L']).name
      if (target) info += ` Goto Flow.=[${target}]`
      return withDesc(info, node)
    }
    default:
      return simple(node, tag)
  }
}

function simple(node: any, fallback: string) {
  return withDesc(readAttr(node, 'NM', fallback), node)
}

function gotoFlowText(node: any, ctx: FlowTextContext, fallback: string) {
  let info = readAttr(node, 'NM', fallback)
  const target = resolve(node, ctx, ['_RGT'], ['L']).name
  if (target) info += ` Goto Flow.=[${target}]`
  return withDesc(info, node)
}

function sessionPairText(node: any, ctx: FlowTextContext, fallback: string, key: string) {
  let info = readAttr(node, 'NM', fallback)
  const s = resolve(node, ctx, ['_RKS'], ['SI']).name
  if (s) info += ` ${key}=[${resolve(node, ctx, ['_RKC'], ['DI']).name} / ${s}]`
  return withDesc(info, node)
}

function receiverConditionText(node: any, ctx: FlowTextContext) {
  let info = readAttr(node, 'NM', 'ReceiverCondition')
  const mode = readAttr(node, 'CM', 'E').toUpperCase()
  const c = resolve(node, ctx, ['_RKC'], ['DI']).name
  const s = resolve(node, ctx, ['_RKS'], ['SI']).name
  const m = resolve(node, ctx, ['_RKM'], ['MI'], ['MN']).name
  if (m) {
    info += ` Msg.=[${c} / ${s} / ${m}]`
  } else if (mode === 'C') {
    const state = connectorStateName(readAttr(node, 'CS', 'C'))
    info += c ? ` Cont.=[${c} == ${state}]` : ` Cont.=[ == ${state}]`
  } else if (mode === 'S') {
    const state = sessionStateName(readAttr(node, 'SS', 'C'))
    info += s ? ` Ssn.=[${s} == ${state}]` : ` Ssn.=[ == ${state}]`
  }
  return withDesc(info, node)
}

function receiverFormulaText(node: any, ctx: FlowTextContext, path: Path) {
  let info = readAttr(node, 'NM', 'ReceiverFormula')
  if (hasPrevious(path)) info += ` Lgc.=[${logicalExp(readAttr(node, 'LG', 'A'))}]`
  if (formulaIsComparison(node)) {
    const operation = readAttr(node, 'OP', 'E').toUpperCase()
    info += ' Fmu.=['
    info += resolve(node, ctx, ['_RKO'], [], ['ON']).name || "'N/A'"
    info += `[${readAttr(node, 'OX', '0')}]`
    info += ` ${operationExp(operation)} `
    if (readAttr(node, 'ET', 'V').toUpperCase() === 'V') info += `"${formulaValue(node, 'OF')}"`
    else info += readAttr(node, 'R') || 'None'
    if (operation === 'CT' || operation === 'SW') info += ')'
    info += ']'
  }
  return withDesc(info, node)
}

function plcFormulaText(node: any, ctx: FlowTextContext, path: Path) {
  let info = readAttr(node, 'NM', 'PlcEventTriggerFormula')
  if (hasPrevious(path)) info += ` Lgc.=[${logicalExp(readAttr(node, 'LG', 'A'))}]`
  if (formulaIsComparison(node)) {
    info += ' Fmu.=['
    info += resolve(node, ctx, ['_RKO'], [], ['ON']).name || "'N/A'"
    info += `[${readAttr(node, 'OX', '0')}]`
    info += ` ${operationExp(readAttr(node, 'OP', 'E'))} `
    info += `"${formulaValue(node, 'OF')}"]`
  }
  return withDesc(info, node)
}

function eventListenerFormulaText(node: any, path: Path) {
  let info = readAttr(node, 'NM', 'EventListenerFormula')
  if (hasPrevious(path)) info += ` Lgc.=[${logicalExp(readAttr(node, 'LG', 'A'))}]`
  if (formulaIsComparison(node)) {
    const opType = readAttr(node, 'OT', 'IN').toUpperCase()
    info += ' Fmu.=['
    info += opType === 'IN' ? readAttr(node, 'ON') || "'N/A'" : EVENT_OPERAND_TYPE[opType] || 'ItemName'
    info += `[${readAttr(node, 'OX', '0')}]`
    info += ` ${operationExp(readAttr(node, 'OP', 'E'))} `
    info += `"${readAttr(node, 'V')}"]`
  }
  return withDesc(info, node)
}

function decisionFormulaText(
  node: any,
  ctx: FlowTextContext,
  path: Path,
  options: { fallback: string; formatAttr: string; withVr: boolean; operandFallback: string[] }
) {
  let info = ''
  if (readAttr(node, 'TF') !== '') info += '[vf.] '
  if (options.withVr && (readAttr(node, '_RKV') !== '' || readAttr(node, 'RN') !== '' || readAttr(node, 'RF') !== '' || readAttr(node, 'Rs') !== '')) info += '[vr.] '
  info += readAttr(node, 'NM', options.fallback)
  if (hasPrevious(path)) info += ` Lgc.=[${logicalExp(readAttr(node, 'LG', 'A'))}]`
  if (formulaIsComparison(node)) {
    info += ' Fmu.=['
    info += resolve(node, ctx, ['_RKO'], [], options.operandFallback).name || "'N/A'"
    info += indexed(readAttr(node, 'OT', 'A'), readAttr(node, 'OX', '0'))
    info += ` ${operationExp(readAttr(node, 'OP', 'E'))} `
    if (readAttr(node, 'VT', 'V').toUpperCase() === 'L') {
      info += resolve(node, ctx, ['_RVL'], [], ['VI', '_VN']).name || "'N/A'"
      info += indexed(readAttr(node, 'VY', 'A'), readAttr(node, 'VX', '0'))
    } else {
      info += `"${formulaValue(node, options.formatAttr)}"`
    }
    info += ']'
  }
  return withDesc(info, node)
}

function indexed(indexType: string, index: string) {
  return indexType.toUpperCase() === 'A' ? '[A]' : `[${index}]`
}

function formulaValue(node: any, formatAttr: string) {
  const value = normalizeText(readAttr(node, 'V'))
  const format = readAttr(node, formatAttr, 'A').toUpperCase()
  if (ASCII_LIKE_FORMATS.has(format)) return value
  return value
}

function normalizeText(value: string) {
  return value.replace(/\/r\/n/g, '').replace(/\r\n?/g, '').replace(/\n/g, '')
}

function withDesc(base: string, node: any) {
  const desc = readAttr(node, 'D')
  return desc ? `${base} Desc=[${desc}]` : base
}

function resolve(node: any, ctx: FlowTextContext, refKeys: string[], seqKeys: string[] = [], fallbackKeys: string[] = []): Resolved {
  for (const key of refKeys) {
    const value = readAttr(node, key)
    if (!value) continue
    const ref = ctx.byRefKey.get(value)
    if (ref) return { name: readAttr(ref.node, 'NM', ref.tag), found: true }
  }
  for (const key of seqKeys) {
    const value = readAttr(node, key)
    if (!value) continue
    const ref = ctx.bySeqId.get(value)
    if (ref) return { name: readAttr(ref.node, 'NM', ref.tag), found: true }
  }
  for (const key of fallbackKeys) {
    const value = readAttr(node, key)
    if (value) return { name: value, found: false }
  }
  return { name: '', found: false }
}

function readAttr(node: any, key: string, fallback = '') {
  const value = node?.[`@_${key}`]
  if (value === undefined || value === null) return fallback
  return String(value)
}

function intAttr(node: any, key: string, fallback: number) {
  const parsed = Number.parseInt(readAttr(node, key), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function hasPrevious(path: Path) {
  if (path.length < 2) return false
  const index = path[path.length - 1]
  return typeof index === 'number' && index > 0
}

function formulaIsComparison(node: any) {
  return readAttr(node, 'TY', 'C').toUpperCase() !== 'B'
}

function isTrue(value: string) {
  return value.toUpperCase() === 'T'
}

function countDirectChildren(node: any) {
  if (!node || typeof node !== 'object') return 0
  let count = 0
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@')) continue
    if (Array.isArray(value)) count += value.filter((item) => item && typeof item === 'object').length
    else if (value && typeof value === 'object') count += 1
  }
  return count
}

function firstChild(node: any, tag: string) {
  return arrayify(node?.[tag]).find((child) => child && typeof child === 'object')
}

function logicalExp(value: string) {
  return value.toUpperCase() === 'A' ? 'And' : 'Or'
}

function operationExp(value: string) {
  return OPERATION_EXP[value.toUpperCase()] || '<='
}

function connectorStateName(value: string) {
  if (value.toUpperCase() === 'O') return 'Opened'
  if (value.toUpperCase() === 'N') return 'Connected'
  if (value.toUpperCase() === 'S') return 'Selected'
  return 'Closed'
}

function sessionStateName(value: string) {
  if (value.toUpperCase() === 'O') return 'Opened'
  if (value.toUpperCase() === 'N') return 'Connected'
  if (value.toUpperCase() === 'S') return 'Selected'
  return 'Closed'
}

function traceActionName(value: string) {
  return value.toUpperCase() === 'T' ? 'Stop' : 'Start'
}

function dataStoreActionName(value: string) {
  return DS_ACTION[value.toUpperCase()] || 'Select'
}

function dataStoreModeName(value: string) {
  return value.toUpperCase() === 'P' ? 'Part' : 'All'
}

function dataStoreLifeScopeName(value: string) {
  return value.toUpperCase() === 'F' ? 'Flow' : 'All'
}

function sqlExecuteTypeName(value: string) {
  if (value.toUpperCase() === 'T') return 'Transaction'
  if (value.toUpperCase() === 'S') return 'Select'
  if (value.toUpperCase() === 'P') return 'Procedure'
  return 'None'
}

function dataAdapterToName(value: string) {
  return value.toUpperCase() === 'T' ? 'DataTable' : 'LinkerSet'
}

function externalDataTypeName(value: string) {
  if (value.toUpperCase() === 'EC') return 'EESCondition'
  if (value.toUpperCase() === 'EI') return 'EESInterlock'
  if (value.toUpperCase() === 'EE') return 'EESEquipmentEvent'
  return 'None'
}

function logCommandName(value: string) {
  if (value.toUpperCase() === 'C') return 'LogCut'
  if (value.toUpperCase() === 'L') return 'LogLevel'
  return 'None'
}

function patternName(value: string) {
  return value.toUpperCase() === 'V' ? 'Flexible' : 'Fixed'
}

function flowDataSourceName(value: string) {
  return value.toUpperCase() === 'D' ? 'DataTable' : 'LinkerSet'
}

function errorActionName(value: string) {
  return value.toUpperCase() === 'S' ? 'Stop' : 'Ignore'
}
