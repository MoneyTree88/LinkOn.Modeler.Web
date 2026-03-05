import { useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap, type Node, type Edge } from 'reactflow'
import { arrayify } from '../lib/utils'
import 'reactflow/dist/style.css'

type Props = {
  data: any
}

export function GraphView({ data }: Props) {
  const { nodes, edges } = useMemo(() => buildGraph(data), [data])

  return (
    <div style={{ height: 420 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        panOnScroll
        zoomOnScroll
      >
        <Background gap={16} color="#e2e8f0" />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  )
}

function buildGraph(data: any): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const root = data?.Q ?? data
  const driver = root?.DR

  if (!driver) return { nodes, edges }

  const baseY = 0
  let x = 0

  // Messages
  const messages = arrayify(driver.MSG)
  messages.forEach((m, idx) => {
    const id = m['@__S'] ?? `msg-${idx}`
    nodes.push({
      id: String(id),
      position: { x: x * 220, y: baseY },
      data: { label: m['@_NM'] ?? 'Message' },
      type: 'default',
    })
    x++
  })

  // Flows (Operation Flow Lists)
  const flows = arrayify(driver.FLW?.CTR?.OFL)
  flows.forEach((f, idx) => {
    const id = f['@__S'] ?? `flow-${idx}`
    nodes.push({
      id: String(id),
      position: { x: idx * 220, y: baseY + 160 },
      data: { label: f['@_NM'] ?? 'Flow' },
      type: 'default',
      style: { background: '#ecfeff', borderColor: '#06b6d4' },
    })
  })

  // Connect messages to flows if reference keys look related (_RKM)
  flows.forEach((f) => {
    const flowId = String(f['@__S'] ?? f['@_NM'])
    ;(arrayify(f.SND) || []).forEach((s, idx) => {
      const msgKey = s['@_RKM']
      if (msgKey) {
        edges.push({
          id: `${flowId}-snd-${idx}`,
          source: flowId,
          target: String(msgKey),
          animated: true,
          label: s['@_NM'] ?? 'Send',
        })
      }
    })
  })

  return { nodes, edges }
}
