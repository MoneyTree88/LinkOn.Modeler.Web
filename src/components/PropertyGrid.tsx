import './PropertyGrid.css'
import { Fragment } from 'react'

type Props = {
  title?: string
  attributes: Record<string, string>
  onChange: (key: string, value: string) => void
  labels?: Record<string, { label?: string; category?: string; order?: number }>
  labelFontFamily?: string
  labelFontSize?: number
  onSpecialEdit?: (key: string, value: string) => void
}

export function PropertyGrid({
  title,
  attributes,
  onChange,
  labels = {},
  labelFontFamily,
  labelFontSize,
  onSpecialEdit,
}: Props) {
  const colorOptions = [
    'Black',
    'DimGray',
    'Gray',
    'DarkGray',
    'Silver',
    'LightGray',
    'White',
    'Maroon',
    'DarkRed',
    'Red',
    'Orange',
    'Yellow',
    'Olive',
    'Green',
    'DarkGreen',
    'Lime',
    'Teal',
    'Cyan',
    'Blue',
    'RoyalBlue',
    'Navy',
    'Purple',
    'Magenta',
    'Brown',
  ]

  const entries = Object.entries(attributes)
    .map(([k, v]) => {
      const info = labels[k] ?? {}
      const labelLower = (info.label ?? '').toLowerCase()
      const keyLower = k.toLowerCase()
      const isBold = keyLower.endsWith('_fb') || labelLower.includes('bold')
      const isColor = keyLower.endsWith('_fc') || labelLower.includes('color')
      const isPrecondition = keyLower.endsWith('_pc')
      let kind: 'text' | 'bool' | 'color' | 'enum' = 'text'
      if (info && (info as any).enumValues) kind = 'enum'
      else if (isBold) kind = 'bool'
      else if (isColor) kind = 'color'
      return {
        key: k,
        value: v,
        label: info.label ?? k,
        category: info.category ?? '',
        order: info.order ?? Number.MAX_SAFE_INTEGER,
        enumValues: (info as any).enumValues as string[] | undefined,
        isPrecondition,
        kind,
      }
    })
    .filter((e) => labels[e.key]) // show only mapped props
    .sort((a, b) => {
      if (a.category === b.category) return (a.order ?? 0) - (b.order ?? 0)
      return a.category.localeCompare(b.category)
    })

  let lastCat = ''
  return (
    <div className="prop-grid" style={{ fontFamily: labelFontFamily, fontSize: labelFontSize }}>
      {title && <div className="prop-grid-title">{title}</div>}
      <table>
        <tbody>
          {entries.map((e) => {
            const catRow =
              e.category && e.category !== lastCat ? (
                <tr className="prop-cat" key={`${e.key}-cat`}>
                  <td colSpan={2}>{e.category}</td>
                </tr>
              ) : null
            lastCat = e.category
            return (
              <Fragment key={e.key}>
                {catRow}
                <tr>
                  <th>{e.label}</th>
                  <td>
                    {e.isPrecondition && onSpecialEdit ? (
                      <div className="precon-cell">
                        <input
                          readOnly
                          value={e.value}
                          onClick={() => onSpecialEdit(e.key, e.value)}
                          title="클릭하여 Precondition을 편집합니다."
                        />
                        <button type="button" onClick={() => onSpecialEdit(e.key, e.value)}>
                          편집
                        </button>
                      </div>
                    ) : e.kind === 'enum' ? (
                      <select value={e.value} onChange={(ev) => onChange(e.key, ev.target.value)}>
                        {e.enumValues?.map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    ) : e.kind === 'bool' ? (
                      <select
                        value={['True', 'False'].includes(e.value) ? e.value : e.value === 'T' ? 'True' : 'False'}
                        onChange={(ev) => onChange(e.key, ev.target.value)}
                      >
                        <option value="True">True</option>
                        <option value="False">False</option>
                      </select>
                    ) : e.kind === 'color' ? (
                      <select value={e.value} onChange={(ev) => onChange(e.key, ev.target.value)}>
                        <option value=""></option>
                        {colorOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input value={e.value} onChange={(ev) => onChange(e.key, ev.target.value)} />
                    )}
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
