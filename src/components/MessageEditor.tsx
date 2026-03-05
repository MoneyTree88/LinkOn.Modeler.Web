import Split from 'react-split'
import { arrayify, getNodeByPath, type Path } from '../lib/utils'
import { useMemo, useState } from 'react'
import { PropMeta } from '../generated/propMeta'
import { enumFromStorage, enumToStorage } from '../lib/enumConverter'
import './MessageEditorExtras.css'

type Props = {
  data: any
  onChange: (mutator: (draft: any) => void) => void
  onChangeFast?: (mutator: (draft: any) => void) => void
  treeFontFamily?: string
  treeFontSize?: number
  propLabelFontFamily?: string
  propLabelFontSize?: number
}

type TreeNode = {
  key: string
  tag: string
  label: string
  path: Path
  node: any
  locked?: boolean
  children: TreeNode[]
}

type NodeRef = {
  node: any
  path: Path
}

type PropFieldMeta = {
  order?: number
  label?: string
  enumType?: string
  enumValues?: readonly string[]
}

type PropRow = {
  prop: string
  label: string
  attr: string
  value: string
  enumType?: string
  enumValues?: readonly string[]
  readOnly?: boolean
  asBool?: boolean
}

const READONLY_PROPS = new Set<string>(['Type', 'ID'])

const PROP_ATTR_MAP: Record<string, Record<string, string>> = {
  DRV: {
    ID: '_S',
    Name: 'NM',
    Description: 'D',
    FontColor: 'FC',
    FontBold: 'FB',
    EapName: 'EN',
    EnabledEventsOfConnectorState: 'C01',
    EnabledEventsOfConnectorError: 'C02',
    EnabledEventsOfConnectorTimeout: 'C03',
    EnabledEventsOfConnectorData: 'C05',
    EnabledEventsOfConnectorDataMessage: 'C04',
    EnabledEventsOfConnectorHandshake: 'C07',
    EnabledEventsOfConnectorControlMessage: 'C08',
    EnabledEventsOfConnectorBlock: 'C09',
    EnabledEventsOfConnectorTelnet: 'C06',
    EnabledEventsOfConnectorSml: 'C10',
    EnabledEventsOfOperationFlow: 'C11',
    EnabledEventsOfProgram: 'C12',
    EnabledEventsOfSessionState: 'C27',
    EnabledGEM: 'C28',
    MessageLogMode: 'C16',
    OperationFlowLogMode: 'C32',
    EnabledLogOfBinary: 'C13',
    EnabledLogOfSml: 'C14',
    EnabledLogOfMessage: 'C15',
    EnabledLogOfScenario: 'C29',
    MaxLogCountOfBinary: 'C20',
    MaxLogCountOfSml: 'C21',
    MaxLogCountOfMessage: 'C22',
    MaxLogCountOfScenario: 'C31',
    EnabledDataStoreSave: 'C23',
    EnabledDataStoreAutoRemove: 'C24',
  },
  CN: {
    ID: '_S',
    Name: 'NM',
    Description: 'D',
    FontColor: 'FC',
    FontBold: 'FB',
    DriverType: 'D1',
    Driver: 'DR',
    Debug: 'DG',
    ConnectorRole: 'MD',
    Protocol: 'PT',
  },
  SN: {
    ID: '_S',
    Name: 'NM',
    Description: 'D',
    FontColor: 'FC',
    FontBold: 'FB',
    SessionID: 'SID',
    Channel: 'CH',
    UpdateRate: 'UR',
    DeadBand: 'DB',
    PlcStateItem: 'PS',
    CustomTagGroup: 'TG',
  },
  ML: {
    ID: '_S',
    Name: 'NM',
    Description: 'D',
    FontColor: 'FC',
    FontBold: 'FB',
  },
  MSG: {
    ID: '_S',
    Name: 'NM',
    Description: 'D',
    SystemReserved: '_SR',
    FontColor: 'FC',
    FontBold: 'FB',
    Stream: 'S',
    Function: 'F',
    Version: 'V',
    OpcPerformType: 'MT',
    OpcReadCache: 'OC',
    Direction: 'DI',
    NeedToReply: 'NR',
    Command: 'C',
    DeliveryType: 'DV',
    Channel: 'CN',
    IgnoreStructure: 'IS',
    IgnoreFormat: 'IF',
    DelayTime: 'DT',
    AutoReply: 'A',
    ReplyMessage: '_RM',
    UsedAutoTrace: 'TU',
    AutoTracePeriod: 'TP',
    LogEnabled: 'LE',
    LogLevel: 'LV',
  },
  IT: {
    ID: '_S',
    Name: 'NM',
    Description: 'D',
    SystemReserved: '_SR',
    FontColor: 'FC',
    FontBold: 'FB',
    GEMVid: 'G03',
    PlcTag: 'IN',
    PlcAddress: 'IN',
    Pattern: 'P',
    FixedLength: 'FL',
    Format: 'F',
    LengthBytes: 'B',
    ValueLinkMode: 'LM',
    OriginalValue: 'V',
    OriginalValue2: 'V',
    OriginalValue3: 'V',
    OriginalEncodingValue: 'EV',
    OriginalLength: 'L',
    RandomValue: 'RD',
    RandomValueMin: 'MN',
    RandomValueMax: 'MX',
    ArrayValue: 'IA',
    Value: 'V',
    EncodingValue: 'EV',
    Length: 'L',
    ValueFilter: 'VF',
    ValueReplacerSet: 'RS',
    ReservedWord: 'RW',
    Extraction: 'ET',
    HashTag: 'HT',
    HashTagCategory: 'HC',
    SequenceDiagramUse: 'SD',
    ScenarioLogKey: 'SK',
  },
}

export function MessageEditor({
  data,
  onChange,
  onChangeFast,
  treeFontFamily,
  treeFontSize,
  propLabelFontFamily,
  propLabelFontSize,
}: Props) {
  const driver = data?.Q?.DR ?? data?.DR ?? data
  const tree = useMemo(() => buildTree(driver), [driver])
  const [selectedPath, setSelectedPath] = useState<Path>([])
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const next = new Set<string>()
    // Default expand level: Driver -> Connector -> Session
    collectExpandableKeys(tree, next, 2)
    return next
  })

  const selectedNode = useMemo(() => getNodeByPath(driver, selectedPath), [driver, selectedPath])
  const selectedTreeNode = useMemo(() => findTreeNodeByPath(tree, selectedPath), [tree, selectedPath])
  const selectedTag = selectedTreeNode?.tag ?? 'DRV'
  const propRows = useMemo(() => buildPropRows(selectedTag, selectedNode), [selectedTag, selectedNode])

  const handlePropChange = (row: PropRow, value: string | boolean) => {
    if (row.readOnly || !row.attr) return
    const nextValue = row.enumType
      ? enumToStorage(row.enumType, String(value))
      : row.asBool
        ? value === true || value === 'T' || value === 'true'
          ? 'T'
          : 'F'
        : String(value ?? '')

    const apply = onChangeFast ?? onChange
    apply((draft) => {
      const target = getNodeByPathMut(draft?.Q?.DR ?? draft?.DR ?? draft, selectedPath)
      if (!target) return
      target[`@_${row.attr}`] = nextValue
    })
  }

  return (
    <div className="panel message-dev">
      <Split className="message-editor split" sizes={[80, 20]} minSize={[240, 200]} gutterSize={6} gutterAlign="center">
        <div className="message-list" style={{ fontFamily: treeFontFamily, fontSize: treeFontSize }}>
          <TreeView
            nodes={tree}
            selectedPath={selectedPath}
            expanded={expanded}
            onSelect={setSelectedPath}
            onToggle={(path) => {
              const key = pathKey(path)
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
              })
            }}
          />
        </div>
        <div className="msg-form">
          <PropertyGrid rows={propRows} onChange={handlePropChange} labelFont={propLabelFontFamily} labelSize={propLabelFontSize} />
        </div>
      </Split>
    </div>
  )
}

// Tree ----------------------------------------------------------------
function TreeView({
  nodes,
  selectedPath,
  expanded,
  onSelect,
  onToggle,
}: {
  nodes: TreeNode[]
  selectedPath: Path
  expanded: Set<string>
  onSelect: (p: Path) => void
  onToggle: (p: Path) => void
}) {
  return (
    <div className="tree">
      {nodes.map((n, i) => (
        <TreeNodeView key={i} node={n} depth={0} selectedPath={selectedPath} expanded={expanded} onSelect={onSelect} onToggle={onToggle} />
      ))}
    </div>
  )
}

function TreeNodeView({
  node,
  depth,
  selectedPath,
  expanded,
  onSelect,
  onToggle,
}: {
  node: TreeNode
  depth: number
  selectedPath: Path
  expanded: Set<string>
  onSelect: (p: Path) => void
  onToggle: (p: Path) => void
}) {
  const isSel = node.key === pathKey(selectedPath)
  const hasChild = node.children.length > 0
  const isOpen = depth === 0 ? true : expanded.has(node.key)
  const icon = getMessageIcon(node)

  return (
    <div className="tree-node" style={{ marginLeft: depth * 5 }}>
      <div
        className={`tree-label ${isSel ? 'active' : ''}`}
        onClick={() => onSelect(node.path)}
        onDoubleClick={(ev) => {
          if (!hasChild) return
          const target = ev.target as HTMLElement
          if (target.closest('.tree-toggle')) return
          onToggle(node.path)
        }}
      >
        {hasChild ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={(ev) => {
              ev.stopPropagation()
              onToggle(node.path)
            }}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle spacer" />
        )}
        {icon && <img className="node-icon" src={`/icons/${icon}.png`} alt={node.tag} crossOrigin="anonymous" />}
        <span className="tag">{node.label}</span>
      </div>
      {hasChild && isOpen && (
        <div className="tree-children">
          {node.children.map((c, i) => (
            <TreeNodeView
              key={i}
              node={c}
              depth={depth + 1}
              selectedPath={selectedPath}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Property Grid -------------------------------------------------------
function PropertyGrid({
  rows,
  onChange,
  labelFont,
  labelSize,
}: {
  rows: PropRow[]
  onChange: (row: PropRow, value: string | boolean) => void
  labelFont?: string
  labelSize?: number
}) {
  return (
    <div className="prop-grid" style={{ fontFamily: labelFont, fontSize: labelSize }}>
      {rows.length === 0 ? (
        <div className="prop-empty">Select a node to edit properties</div>
      ) : (
        rows.map((row) => (
          <div key={`${row.prop}-${row.attr}`} className="prop-row">
            <label>{row.label}</label>
            {row.enumType && row.enumValues && row.enumValues.length > 0 ? (
              <select value={row.value} onChange={(e) => onChange(row, e.target.value)} disabled={row.readOnly}>
                {row.enumValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : row.asBool ? (
              <input type="checkbox" checked={row.value === 'T'} onChange={(e) => onChange(row, e.target.checked)} disabled={row.readOnly} />
            ) : (
              <input value={row.value} onChange={(e) => onChange(row, e.target.value)} disabled={row.readOnly} />
            )}
          </div>
        ))
      )}
    </div>
  )
}

// Helpers -------------------------------------------------------------
function buildTree(driver: any): TreeNode[] {
  if (!driver) return []
  const root: TreeNode = {
    key: pathKey([]),
    tag: 'DRV',
    label: buildLabel(driver, 'DRV'),
    node: driver,
    locked: String(driver?.['@_LC'] ?? '').toUpperCase() === 'T',
    path: [],
    children: buildConnectors(driver, []),
  }
  return [root]
}

function buildConnectors(node: any, path: Path): TreeNode[] {
  const directFromMM: NodeRef[] = arrayify(node?.MM).flatMap((mm, mmIdx) =>
    arrayify((mm as any)?.CN).map((cn, cnIdx) => ({ node: cn, path: [...path, 'MM', mmIdx, 'CN', cnIdx] as Path }))
  )
  const direct = directFromMM.length > 0 ? directFromMM : arrayify(node?.CN).map((cn, cnIdx) => ({ node: cn, path: [...path, 'CN', cnIdx] as Path }))
  return direct.map((ref) => toTreeNode(ref, 'CN', buildSessions))
}

function buildSessions(node: any, path: Path): TreeNode[] {
  return arrayify(node?.SN).map((sn, idx) => toTreeNode({ node: sn, path: [...path, 'SN', idx] }, 'SN', buildMessageLists))
}

function buildMessageLists(node: any, path: Path): TreeNode[] {
  return arrayify(node?.ML).map((ml, idx) => toTreeNode({ node: ml, path: [...path, 'ML', idx] }, 'ML', buildMessages))
}

function buildMessages(node: any, path: Path): TreeNode[] {
  const msg = arrayify(node?.MSG).map((m, idx) => ({ node: m, path: [...path, 'MSG', idx] as Path }))
  const mg = arrayify(node?.MG).map((m, idx) => ({ node: m, path: [...path, 'MG', idx] as Path }))
  return [...msg, ...mg].map((ref) => toTreeNode(ref, 'MSG', buildItems))
}

function buildItems(node: any, path: Path): TreeNode[] {
  return arrayify(node?.IT).map((it, idx) => toTreeNode({ node: it, path: [...path, 'IT', idx] }, 'IT', buildItems))
}

function toTreeNode(ref: NodeRef, tag: string, next: (node: any, path: Path) => TreeNode[]): TreeNode {
  return {
    key: pathKey(ref.path),
    tag,
    label: buildLabel(ref.node, tag),
    node: ref.node,
    locked: String(ref.node?.['@_LC'] ?? '').toUpperCase() === 'T',
    path: ref.path,
    children: next(ref.node, ref.path),
  }
}

const FORMAT_NAME_TO_SHORT: Record<string, string> = {
  List: 'L',
  AsciiList: 'AL',
  Binary: 'B',
  Boolean: 'BL',
  Char: 'C',
  Ascii: 'A',
  JIS8: 'J8',
  A2: 'A2',
  I8: 'I8',
  I4: 'I4',
  I2: 'I2',
  I1: 'I1',
  F8: 'F8',
  F4: 'F4',
  U8: 'U8',
  U4: 'U4',
  U2: 'U2',
  U1: 'U1',
  Unknown: 'UN',
  Raw: 'R',
  KO: 'KO',
}

const FORMAT_SHORT_VALUES = new Set<string>(Object.values(FORMAT_NAME_TO_SHORT))
const LIST_LIKE_FORMATS = new Set<string>(['L', 'AL', 'UN', 'R'])
const ASCII_LIKE_FORMATS = new Set<string>(['A', 'J8', 'A2', 'C'])
const KNOWN_DRIVER_TYPES = new Set<string>(['CUSTOM', 'OPC', 'SECS', 'PLC', 'MODBUS', 'HOST', 'COGNEX'])

function buildLabel(node: any, tag: string) {
  switch (tag) {
    case 'DRV':
      return buildDriverText(node)
    case 'CN':
      return buildConnectorText(node)
    case 'SN':
      return buildSessionText(node)
    case 'ML':
      return buildMessageListText(node)
    case 'MSG':
    case 'MG':
      return buildMessageText(node)
    case 'IT':
      return buildItemText(node)
    default:
      return appendDesc(readAttr(node, 'NM', tag), readAttr(node, 'D'))
  }
}

function buildDriverText(node: any) {
  const name = readAttr(node, 'NM', 'Driver')
  const eapName = readAttr(node, 'EN')
  return appendDesc(`${name} Eap=[${eapName}]`, readAttr(node, 'D'))
}

function buildConnectorText(node: any) {
  const name = readAttr(node, 'NM', 'Connector')
  const driverType = toDriverTypeName(readAttr(node, 'D1'))
  const protocol = resolveProtocolName(readAttr(node, 'PT'), driverType)
  return appendDesc(`${name} Driver Type=[${driverType}] Protocol=[${protocol}]`, readAttr(node, 'D'))
}

function buildSessionText(node: any) {
  const name = readAttr(node, 'NM', 'Session')
  const sessionId = parseIntAttr(node, 'SID', 0)
  let info = `${name} SessionID=[${sessionId}]`
  if (readAttr(node, '_RCG') !== '') {
    const tagGroupName = readAttr(node, 'TG')
    if (tagGroupName !== '') {
      info += ` TagGroup=[${tagGroupName}]`
    }
  }
  return appendDesc(info, readAttr(node, 'D'))
}

function buildMessageListText(node: any) {
  return appendDesc(readAttr(node, 'NM', 'MessageList'), readAttr(node, 'D'))
}

function buildMessageText(node: any) {
  const driverType = toDriverTypeName(readAttr(node, 'D1'))
  const stream = parseIntAttr(node, 'S', 0)
  const func = parseIntAttr(node, 'F', 0)
  const version = parseIntAttr(node, 'V', 0)

  let info = ''
  if (driverType === 'SECS') {
    info += `[S${stream} F${func} V${version}] `
  } else {
    info += `[V${version}] `
  }

  if (readAttr(node, '_RRM') !== '') {
    info += '[rp] '
  }

  const needReply = isTrue(readAttr(node, 'NR', 'F'))
  const autoReply = isTrue(readAttr(node, 'A', 'F'))
  if (!needReply && autoReply) {
    info += '[ar>>] '
  }

  info += readAttr(node, 'NM', 'Message')
  return appendDesc(info, readAttr(node, 'D'))
}

function buildItemText(node: any) {
  let info = ''
  const pattern = readAttr(node, 'P', 'F').toUpperCase()
  const fixedLength = parseIntAttr(node, 'FL', 1)
  const formatShort = toFormatShortName(readAttr(node, 'F', 'A'))
  const length = parseIntAttr(node, 'L', 0)
  const name = readAttr(node, 'NM', 'Item')
  const hasLargeValue = isTrue(readAttr(node, 'LT', 'F'))

  if (pattern === 'F' && fixedLength > 1) {
    info += `[fx(${fixedLength}).] `
  } else if (pattern === 'V') {
    info += '[fl.] '
  }

  if (readAttr(node, 'VF') !== '') {
    info += '[vf.] '
  }

  if (readAttr(node, '_RKP') !== '') {
    info += `[pt. ${readAttr(node, 'IN')}] `
  }

  if (readAttr(node, '_RKV') !== '' || readAttr(node, 'RS') !== '') {
    info += '[vr.] '
  }

  if (readAttr(node, 'PC') !== '') {
    info += '[pc.] '
  }

  if (isValueLinkModeFull(readAttr(node, 'LM', 'P'))) {
    info += '[f.] '
  }

  info += formatShort

  const encodedValue = normalizeItemValue(readAttr(node, 'EV') || readAttr(node, 'V'))
  if (LIST_LIKE_FORMATS.has(formatShort)) {
    info += `[${length}] ${name}`
  } else if (ASCII_LIKE_FORMATS.has(formatShort)) {
    const showValue = encodedValue.length > 100 ? `${encodedValue.slice(0, 100)}...` : encodedValue
    info += `[${length}] ${name}="${showValue}"`
  } else {
    let showValue = encodedValue
    if (showValue.length > 100) {
      showValue = `${showValue.slice(0, 15)}...`
    } else if (hasLargeValue) {
      showValue = `${showValue}...`
    }
    info += `[${length}] ${name}="${showValue}"`
  }

  return appendDesc(info, readAttr(node, 'D'))
}

function appendDesc(base: string, desc: string) {
  if (!desc) return base
  return `${base} Desc=[${desc}]`
}

function readAttr(node: any, key: string, fallback = '') {
  const value = node?.[`@_${key}`]
  if (value === undefined || value === null) return fallback
  return String(value)
}

function parseIntAttr(node: any, key: string, fallback: number) {
  const text = readAttr(node, key)
  const num = Number.parseInt(text, 10)
  return Number.isFinite(num) ? num : fallback
}

function isTrue(value: string) {
  return value.toUpperCase() === 'T'
}

function toDriverTypeName(stored: string) {
  const mapped = String(enumFromStorage('QDriverType', stored || 'C') || '').toUpperCase()
  if (KNOWN_DRIVER_TYPES.has(mapped)) return mapped
  if (stored) return stored.toUpperCase()
  return 'CUSTOM'
}

function resolveProtocolName(protocol: string, driverType: string) {
  if (protocol) return protocol
  if (driverType === 'SECS') return 'HSMS'
  if (driverType === 'HOST') return 'H101'
  if (driverType === 'OPC') return 'OPCUA'
  if (driverType === 'PLC') return 'LS_XGK'
  if (driverType === 'MODBUS') return 'MODBUSTCP'
  if (driverType === 'COGNEX') return 'DATAMANTCP'
  return 'CUSTOM'
}

function toFormatShortName(stored: string) {
  const mapped = enumFromStorage('QFormat', stored || 'A')
  if (FORMAT_NAME_TO_SHORT[mapped]) return FORMAT_NAME_TO_SHORT[mapped]

  const upperStored = (stored || '').toUpperCase()
  if (FORMAT_SHORT_VALUES.has(upperStored)) return upperStored

  const upperMapped = String(mapped || '').toUpperCase()
  if (FORMAT_SHORT_VALUES.has(upperMapped)) return upperMapped
  return 'A'
}

function isValueLinkModeFull(stored: string) {
  const mapped = String(enumFromStorage('QValueLinkMode', stored || 'P'))
  return mapped === 'Full' || stored.toUpperCase() === 'F'
}

function normalizeItemValue(value: string) {
  return value.replace(/\/r\/n/g, '').replace(/\r\n?/g, '').replace(/\n/g, '')
}

function buildPropRows(tag: string, node: any): PropRow[] {
  const metaTag = normalizeMetaTag(tag)
  const metaByTag = (PropMeta as any)?.[metaTag] as Record<string, PropFieldMeta> | undefined
  const attrByProp = PROP_ATTR_MAP[metaTag] || {}
  if (!metaByTag) return []

  const rows: PropRow[] = []
  for (const [propName, meta] of Object.entries(metaByTag)) {
    if (propName === 'Type') {
      rows.push({
        prop: propName,
        label: meta.label || propName,
        attr: '',
        value: getTypeLabel(metaTag),
        readOnly: true,
      })
      continue
    }

    const attrKey = attrByProp[propName]
    if (!attrKey) continue
    const raw = node?.[`@_${attrKey}`]
    const rawText = raw === undefined || raw === null ? '' : String(raw)
    const value = meta.enumType ? enumFromStorage(meta.enumType, rawText) : rawText
    rows.push({
      prop: propName,
      label: meta.label || propName,
      attr: attrKey,
      value,
      enumType: meta.enumType,
      enumValues: meta.enumValues,
      readOnly: READONLY_PROPS.has(propName),
      asBool: !meta.enumType && (rawText === 'T' || rawText === 'F'),
    })
  }

  rows.sort((a, b) => {
    const ma = (metaByTag[a.prop]?.order ?? 9999) as number
    const mb = (metaByTag[b.prop]?.order ?? 9999) as number
    return ma - mb
  })

  return rows
}

function normalizeMetaTag(tag: string) {
  if (tag === 'MG') return 'MSG'
  return tag
}

function getTypeLabel(tag: string) {
  const map: Record<string, string> = {
    DRV: 'Driver',
    CN: 'Connector',
    SN: 'Session',
    ML: 'MessageList',
    MSG: 'Message',
    IT: 'Item',
  }
  return map[tag] || tag
}

function findTreeNodeByPath(nodes: TreeNode[], path: Path): TreeNode | null {
  for (const n of nodes) {
    if (isSamePath(n.path, path)) return n
    const found = findTreeNodeByPath(n.children, path)
    if (found) return found
  }
  return null
}

function collectExpandableKeys(nodes: TreeNode[], out: Set<string>, maxDepth: number, depth = 0) {
  nodes.forEach((node) => {
    if (node.children.length > 0 && depth <= maxDepth) {
      out.add(pathKey(node.path))
      collectExpandableKeys(node.children, out, maxDepth, depth + 1)
    }
  })
}

function pathKey(path: Path) {
  if (path.length === 0) return 'root'
  return path.join('.')
}

function isSamePath(a: Path, b: Path) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function getNodeByPathMut(root: any, path: Path): any {
  let cur = root
  for (let i = 0; i < path.length; i += 2) {
    const key = path[i] as string
    const idx = path[i + 1] as number
    const arr = arrayify(cur?.[key])
    cur = arr[idx]
    if (!cur) return undefined
  }
  return cur
}

function getMessageIcon(node: TreeNode) {
  const locked = String(node.node?.['@_LC'] ?? '').toUpperCase() === 'T'
  const tag = node.tag

  if (tag === 'DRV') {
    // c_QCommon.GetImageByObject uses "Driver" for Driver; web resources expose lock/unlock variants.
    return 'Driver_unlock'
  }

  if (tag === 'CN') {
    const state = String(node.node?.['@_ST'] ?? 'C').toUpperCase()
    if (state === 'O') return locked ? 'Connector_Opened_lock' : 'Connector_Opened_unlock'
    if (state === 'N') return locked ? 'Connector_Connected_lock' : 'Connector_Connected_unlock'
    if (state === 'S') return locked ? 'Connector_Selected_lock' : 'Connector_Selected_unlock'
    return locked ? 'Connector_Closed_lock' : 'Connector_Closed_unlock'
  }

  if (tag === 'SN') {
    return locked ? 'Session_lock' : 'Session_unlock'
  }

  if (tag === 'ML') {
    return locked ? 'MessageList_lock' : 'MessageList_unlock'
  }

  if (tag === 'MSG') {
    const direction = String(node.node?.['@_DI'] ?? '').toUpperCase()
    if (direction === 'E') return locked ? 'Message_Eq_lock' : 'Message_Eq_unlock'
    if (direction === 'H') return locked ? 'Message_Host_lock' : 'Message_Host_unlock'
    return locked ? 'Message_Both_lock' : 'Message_Both_unlock'
  }

  if (tag === 'IT') {
    const format = String(node.node?.['@_F'] ?? '').toUpperCase()
    const isList = format === 'L' || format === 'LIST'
    if (isList) return locked ? 'ItemList_lock' : 'ItemList_unlock'
    return locked ? 'Item_lock' : 'Item_unlock'
  }

  return 'Message_Both_unlock'
}
