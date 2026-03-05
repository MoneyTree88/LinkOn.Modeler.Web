import { useEffect, useMemo, useState } from 'react'
import Split from 'react-split'
import { arrayify, getNodeByPath, type Path } from '../lib/utils'
import { buildFlowObjectText, buildFlowTextContext, type FlowTextContext } from '../lib/flowText'
import ReactFlow, { Background, Controls, MiniMap, Position, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'
import './MessageEditorExtras.css'

type Props = {
  data: any
  treeFontFamily?: string
  treeFontSize?: number
}

type TreeNodeModel = {
  tag: string
  label: string
  path: Path
  node: any
  locked: boolean
  children: TreeNodeModel[]
}

type DiagramGraph = {
  nodes: Node[]
  edges: Edge[]
}

type DiagramEntry = {
  id: string
  parentId?: string
  tag: string
  depth: number
  path: Path
  node: any
}

export function FlowEditor({ data, treeFontFamily, treeFontSize }: Props) {
  const driver = data?.Q?.DR ?? data?.DR ?? data
  const textContext = useMemo(() => buildFlowTextContext(driver), [driver])
  const tree = useMemo(() => buildFlowTree(driver, textContext), [driver, textContext])

  const [selectedPath, setSelectedPath] = useState<Path>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (tree.length === 0) {
      setSelectedPath([])
      setExpanded(new Set())
      return
    }

    const nextExpanded = new Set<string>()
    // Default expand level: Driver -> Controller
    collectExpandableKeys(tree, nextExpanded, 1)
    setExpanded(nextExpanded)

    if (!findTreeNodeByPath(tree, selectedPath)) {
      setSelectedPath([])
    }
  }, [tree])

  const selectedModel = useMemo(() => findTreeNodeByPath(tree, selectedPath), [tree, selectedPath])
  const selectedNode = useMemo(() => getNodeByPath(driver, selectedPath), [driver, selectedPath])
  const graph = useMemo<DiagramGraph>(() => {
    if (!selectedModel || selectedModel.tag !== 'OFO') return { nodes: [], edges: [] }
    return buildFlowDiagram(selectedNode, textContext, selectedModel.path)
  }, [selectedModel, selectedNode, textContext])

  const onToggle = (path: Path) => {
    const key = pathKey(path)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="panel message-dev">
      <Split className="message-editor split" sizes={[30, 70]} minSize={[280, 260]} gutterSize={6} gutterAlign="center">
        <div className="message-list tree-only" style={{ fontFamily: treeFontFamily, fontSize: treeFontSize }}>
          <TreeView nodes={tree} selectedPath={selectedPath} expanded={expanded} onSelect={setSelectedPath} onToggle={onToggle} />
        </div>

        <div className="msg-form flow-form">
          <FlowDiagram graph={graph} enabled={selectedModel?.tag === 'OFO'} />
        </div>
      </Split>
    </div>
  )
}

function TreeView({
  nodes,
  selectedPath,
  expanded,
  onSelect,
  onToggle,
}: {
  nodes: TreeNodeModel[]
  selectedPath: Path
  expanded: Set<string>
  onSelect: (path: Path) => void
  onToggle: (path: Path) => void
}) {
  return (
    <div className="tree">
      {nodes.map((node, idx) => (
        <TreeNodeView
          key={idx}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={onToggle}
        />
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
  node: TreeNodeModel
  depth: number
  selectedPath: Path
  expanded: Set<string>
  onSelect: (path: Path) => void
  onToggle: (path: Path) => void
}) {
  const hasChild = node.children.length > 0
  const isOpen = depth === 0 ? true : expanded.has(pathKey(node.path))
  const isSelected = isSamePath(node.path, selectedPath)
  const icon = getTreeIcon(node)

  return (
    <div className="tree-node" style={{ marginLeft: depth * 5 }}>
      <div
        className={`tree-label ${isSelected ? 'active' : ''}`}
        onClick={() => onSelect(node.path)}
        onDoubleClick={(ev) => {
          if (!hasChild) return
          const target = ev.target as HTMLElement
          if (target.closest('.tree-toggle')) return
          onToggle(node.path)
        }}
        style={{ color: normalizeColor(node.node?.['@_FC']), fontWeight: node.node?.['@_FB'] === 'T' ? 700 : undefined }}
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

        {icon && <img className="node-icon" src={`/icons/${icon}.png`} alt={node.tag} />}
        <span className="tag">{node.label}</span>
      </div>

      {hasChild && isOpen && (
        <div className="tree-children">
          {node.children.map((child, idx) => (
            <TreeNodeView
              key={idx}
              node={child}
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

function FlowDiagram({ graph, enabled }: { graph: DiagramGraph; enabled: boolean }) {
  if (!enabled) {
    return (
      <div className="flow-diagram">
        <div className="flow-diagram-title">Flow Diagram</div>
        <div className="flow-diagram-empty">Select an OperationFlow node in the tree.</div>
      </div>
    )
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="flow-diagram">
        <div className="flow-diagram-title">Flow Diagram</div>
        <div className="flow-diagram-empty">No child nodes found.</div>
      </div>
    )
  }

  return (
    <div className="flow-diagram">
      <div className="flow-diagram-title">Flow Diagram</div>
      <div className="flow-diagram-canvas">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          fitView={true}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <MiniMap pannable={false} zoomable={false} />
          <Controls showInteractive={false} />
          <Background />
        </ReactFlow>
      </div>
    </div>
  )
}

function buildFlowTree(driver: any, ctx: FlowTextContext): TreeNodeModel[] {
  if (!driver || typeof driver !== 'object') return []

  const root: TreeNodeModel = {
    tag: 'DRV',
    label: buildFlowObjectText('DRV', driver, ctx, []),
    path: [],
    node: driver,
    locked: isLocked(driver),
    children: [],
  }

  const flwNodes = arrayify(driver?.FLW)
  root.children = flwNodes.flatMap((flw, flwIdx) => {
    const controllers = arrayify(flw?.CTR)
    return controllers.map((controller, ctrIdx) => {
      const ctrPath: Path = ['FLW', flwIdx, 'CTR', ctrIdx]
      const controllerNode: TreeNodeModel = {
        tag: 'CTR',
        label: buildFlowObjectText('CTR', controller, ctx, ctrPath),
        path: ctrPath,
        node: controller,
        locked: isLocked(controller),
        children: [],
      }

      const oflNodes = arrayify(controller?.OFL)
      controllerNode.children = oflNodes.map((ofl, oflIdx) => {
        const oflPath: Path = [...ctrPath, 'OFL', oflIdx]
        const oflNode: TreeNodeModel = {
          tag: 'OFL',
          label: buildFlowObjectText('OFL', ofl, ctx, oflPath),
          path: oflPath,
          node: ofl,
          locked: isLocked(ofl),
          children: [],
        }

        const ofoNodes = arrayify(ofl?.OFO)
        oflNode.children = ofoNodes.map((ofo, ofoIdx) => {
          const ofoPath: Path = [...oflPath, 'OFO', ofoIdx]
          return {
            tag: 'OFO',
            label: buildFlowObjectText('OFO', ofo, ctx, ofoPath),
            path: ofoPath,
            node: ofo,
            locked: isLocked(ofo),
            children: [],
          }
        })

        return oflNode
      })

      return controllerNode
    })
  })

  return [root]
}

function buildFlowDiagram(root: any, ctx: FlowTextContext, rootPath: Path): DiagramGraph {
  if (!root || typeof root !== 'object') return { nodes: [], edges: [] }

  const entries: DiagramEntry[] = []
  let seq = 0

  const walk = (node: any, tag: string, path: Path, depth: number, parentId?: string) => {
    const id = `n-${seq++}`
    entries.push({ id, parentId, tag, depth, path, node })

    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('@')) continue
      const children = arrayify(value)
      children.forEach((child, idx) => {
        if (child && typeof child === 'object') {
          walk(child, key, [...path, key, idx], depth + 1, id)
        }
      })
    }
  }

  walk(root, 'OFO', rootPath, 0)

  const nodes: Node[] = []
  const edges: Edge[] = []

  entries.forEach((entry, index) => {
    const icon = getFlowObjectIcon(entry.tag, isLocked(entry.node))
    const color = normalizeColor(entry.node?.['@_FC'])
    const bold = String(entry.node?.['@_FB'] ?? '').toUpperCase() === 'T'

    nodes.push({
      id: entry.id,
      position: {
        x: entry.depth * 260,
        y: index * 100,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: {
        borderRadius: 10,
        border: '1px solid #cbd5e1',
        background: '#ffffff',
        padding: 8,
        minWidth: 180,
      },
      data: {
        label: (
          <div className="flow-node-label" style={{ color, fontWeight: bold ? 700 : undefined }}>
            <img src={`/icons/${icon}.png`} alt={entry.tag} />
            <div className="flow-node-text">
              <div className="flow-node-title">{buildFlowObjectText(entry.tag, entry.node, ctx, entry.path)}</div>
            </div>
          </div>
        ),
      },
    })

    if (entry.parentId) {
      edges.push({
        id: `e-${entry.parentId}-${entry.id}`,
        source: entry.parentId,
        target: entry.id,
        type: 'smoothstep',
        animated: false,
      })
    }
  })

  return { nodes, edges }
}

function collectExpandableKeys(nodes: TreeNodeModel[], out: Set<string>, maxDepth: number, depth = 0) {
  nodes.forEach((node) => {
    if (node.children.length > 0 && depth <= maxDepth) {
      out.add(pathKey(node.path))
      collectExpandableKeys(node.children, out, maxDepth, depth + 1)
    }
  })
}

function findTreeNodeByPath(nodes: TreeNodeModel[], path: Path): TreeNodeModel | null {
  for (const node of nodes) {
    if (isSamePath(node.path, path)) return node
    const child = findTreeNodeByPath(node.children, path)
    if (child) return child
  }
  return null
}

function isSamePath(a: Path, b: Path) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function pathKey(path: Path) {
  if (path.length === 0) return 'root'
  return path.join('.')
}

function isLocked(node: any) {
  return String(node?.['@_LC'] ?? '').toUpperCase() === 'T'
}

function normalizeColor(value: unknown) {
  if (!value) return undefined
  const text = String(value).trim()
  if (!text) return undefined
  return text
}

function getTreeIcon(node: TreeNodeModel) {
  if (node.tag === 'DRV') return node.locked ? 'Driver_lock' : 'Driver_unlock'
  if (node.tag === 'CTR') return node.locked ? 'Controller_lock' : 'Controller_unlock'
  if (node.tag === 'OFL') return node.locked ? 'OperationFlowList_lock' : 'OperationFlowList_unlock'
  if (node.tag === 'OFO') return node.locked ? 'OperationFlow_lock' : 'OperationFlow_unlock'
  return 'OperationFlow_unlock'
}

const FlowObjectIconMap: Record<string, string> = {
  OFO: 'OperationFlow_unlock',
  RCV: 'Receiver',
  RCN: 'ReceiverCondition',
  RCF: 'ReceiverFormula',
  RFM: 'ReceiverFormula',
  SND: 'Sender',
  SNM: 'SenderMessage',
  LKH: 'LinkerHandler',
  PET: 'PlcEventTrigger',
  PCN: 'PlcEventTriggerCondition',
  PCF: 'PlcEventTriggerFormula',
  CMT: 'Comment',
  SLP: 'Sleep',
  DCS: 'Decision',
  DSC: 'DecisionCondition',
  DSF: 'DecisionConditionFormula',
  DCC: 'DecisionCondition',
  DCF: 'DecisionConditionFormula',
  DDS: 'DynamicDecision',
  DDC: 'DynamicDecisionCondition',
  DDF: 'DynamicDecisionConditionFormula',
  ELN: 'EventListener',
  EC: 'EventListenerCondition',
  ECF: 'EventListenerConditionFormula',
  ELS: 'EventListener',
  ELC: 'EventListenerCondition',
  ELF: 'EventListenerConditionFormula',
  BPS: 'ByPass',
  BPA: 'ByPassAdapter',
  GTO: 'Goto',
  GTL: 'GotoLabel',
  DSH: 'DataStoreSetter',
  SVE: 'StaticVariableSetValueSetter',
  FNH: 'FunctionSetter',
  FUN: 'Function',
  FUL: 'FtpUploader',
  FDL: 'FtpDownloader',
  SAP: 'SqlAppender',
  SDA: 'SqlDataAdapter',
  SEC: 'SqlExecuter',
  EDS: 'ExternalDataSetter',
  EDL: 'ExternalDataSetter',
  DSS: 'DataStoreSetter',
  SDV: 'StaticVariableSetValueSetter',
  FNS: 'FunctionSetter',
  FUD: 'FtpUploader',
  FDD: 'FtpDownloader',
  SQA: 'SqlAppender',
  SQE: 'SqlExecuter',
  SQD: 'SqlDataAdapter',
  EFD: 'ExternalDataSetter',
  EFE: 'ExternalFlowExecuter',
  CCH: 'CalculationHandler',
  CCT: 'Calculator',
  CCF: 'CalculatorConditionFormula',
  TMA: 'TraceMessageAdapter',
  ATA: 'TraceMessageAdapter',
  ATH: 'AutoTraceHandler',
  STH: 'SECSTraceHandler',
  SPJ: 'SpecJudge',
  SJG: 'SpecJudge',
  LGH: 'LogHandler',
  GMH: 'GEMHandler',
  HTR: 'HostTrigger',
  HTRF: 'HostTransfer',
  HTX: 'HostTransmitter',
  MSA: 'MailSenderAdapter',
  MSD: 'MailSender',
  PCH: 'PlugInCommandHandler',
  WOM: 'WriteOpcMessage',
  ROM: 'ReadOpcMessage',
  SMM: 'SendMessage',
  SHM: 'SendHostMessage',
  RVL: 'ResetValue',
}

function getFlowObjectIcon(tag: string, locked: boolean) {
  if (tag === 'OFO') return locked ? 'OperationFlow_lock' : 'OperationFlow_unlock'
  const mapped = FlowObjectIconMap[tag]
  if (mapped) return mapped
  return 'OperationFlow_unlock'
}
