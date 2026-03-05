import './OptionDialog.css'
import { useState } from 'react'

type Props = {
  initialTreeFont: string
  initialTreeSize: number
  initialPropFont: string
  initialPropSize: number
  onApply: (vals: { treeFont: string; treeSize: number; propFont: string; propSize: number }) => void
  onCancel: () => void
}

export function OptionDialog({ initialTreeFont, initialTreeSize, initialPropFont, initialPropSize, onApply, onCancel }: Props) {
  const fontOptions = Array.from(
    new Set([
      'Pretendard',
      'Inter',
      'Noto Sans KR',
      'Noto Sans',
      'Nanum Gothic',
      'Malgun Gothic',
      'Segoe UI',
      'Arial',
      'Helvetica',
      'Roboto',
      'Times New Roman',
      'Courier New',
      'Monaco',
      'system-ui',
      initialTreeFont,
      initialPropFont,
    ].filter(Boolean))
  )
  const [treeFont, setTreeFont] = useState(initialTreeFont)
  const [treeSize, setTreeSize] = useState(initialTreeSize)
  const [propFont, setPropFont] = useState(initialPropFont)
  const [propSize, setPropSize] = useState(initialPropSize)

  return (
    <div className="option-backdrop">
      <div className="option-dialog">
        <h3>옵션</h3>
        <div className="option-grid">
          <label>Tree Font</label>
          <select value={treeFont} onChange={(e) => setTreeFont(e.target.value)}>
            {fontOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <label>Tree Size</label>
          <input type="number" value={treeSize} min={8} max={32} onChange={(e) => setTreeSize(Number(e.target.value))} />

          <label>Property Label Font</label>
          <select value={propFont} onChange={(e) => setPropFont(e.target.value)}>
            {fontOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <label>Property Label Size</label>
          <input type="number" value={propSize} min={8} max={32} onChange={(e) => setPropSize(Number(e.target.value))} />
        </div>
        <div className="option-actions">
          <button onClick={onCancel}>취소</button>
          <button className="primary" onClick={() => onApply({ treeFont, treeSize, propFont, propSize })}>
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
