import './RibbonBar.css'
import { useMemo, useState, type ReactElement } from 'react'

export type RibbonButton = {
  label: string
  icon: string
  onClick?: () => void
  disabled?: boolean
}

export type RibbonSection = {
  title: string
  buttons: RibbonButton[]
  collapsible?: boolean
  defaultCollapsed?: boolean
}

type Props = {
  sections: RibbonSection[]
}

export function RibbonBar({ sections }: Props) {
  const initial = useMemo(() => {
    const map: Record<string, boolean> = {}
    sections.forEach((s) => {
      map[s.title] = !!s.collapsible && !!s.defaultCollapsed
    })
    return map
  }, [sections])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(initial)
  const [allCollapsed, setAllCollapsed] = useState(false)

  const toggle = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <div className={`ribbon ${allCollapsed ? 'ribbon-collapsed' : ''}`}>
      <div className={`ribbon-body ${allCollapsed ? 'collapsed' : ''}`}>
        {sections.map((section, idx) => (
          <div key={idx} className={`ribbon-section ${collapsed[section.title] ? 'collapsed' : ''}`}>
            <div className="section-header">
              <div className="section-title">{section.title}</div>
              {section.collapsible && (
                <button
                  className={`collapse-btn ${collapsed[section.title] ? 'collapsed' : 'expanded'}`}
                  onClick={() => toggle(section.title)}
                  aria-label="toggle section"
                  title={collapsed[section.title] ? 'Expand' : 'Collapse'}
                />
              )}
            </div>
            {!collapsed[section.title] && (
              <div className="ribbon-buttons">
                {section.buttons.map((btn, i) => {
                  const buttonClass = `ribbon-btn ribbon-btn-${btn.label.toLowerCase().replace(/\s+/g, '-')}`
                  return (
                    <button
                      key={i}
                      className={buttonClass}
                      onClick={btn.onClick}
                      disabled={btn.disabled}
                      title={btn.label}
                    >
                      <div className="icon">
                        <RibbonIcon label={btn.label} fallback={btn.icon} />
                      </div>
                      <div className="label">{btn.label}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        className={`ribbon-toggle-all ${allCollapsed ? 'collapsed' : 'expanded'}`}
        onClick={() => setAllCollapsed((v) => !v)}
        aria-label="toggle ribbon"
        title={allCollapsed ? 'Expand ribbon' : 'Collapse ribbon'}
      />
    </div>
  )
}

function RibbonIcon({ label, fallback }: { label: string; fallback?: string }) {
  const key = label.toLowerCase().replace(/\s+/g, '')
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  const iconByKey: Record<string, ReactElement> = {
    new: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h8l4 4v14H6z" {...common} />
        <path d="M14 3v5h5" {...common} />
        <path d="M12 10v8M8 14h8" {...common} />
      </svg>
    ),
    open: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7h7l2 2h9v10H3z" {...common} />
        <path d="M3 7V5h7l2 2" {...common} />
      </svg>
    ),
    home: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11l8-7 8 7" {...common} />
        <path d="M6 10v9h12v-9" {...common} />
        <path d="M10 19v-5h4v5" {...common} />
      </svg>
    ),
    save: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h13l3 3v13H4z" {...common} />
        <path d="M8 4v6h8V4M8 20v-6h8v6" {...common} />
      </svg>
    ),
    saveas: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h13l3 3v13H4z" {...common} />
        <path d="M8 4v6h8V4M8 20v-6h8v6" {...common} />
        <path d="M15.5 14.5l4-4M17 19h4v-4" {...common} />
      </svg>
    ),
    option: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" {...common} />
        <circle cx="9" cy="7" r="2" {...common} />
        <circle cx="15" cy="12" r="2" {...common} />
        <circle cx="11" cy="17" r="2" {...common} />
      </svg>
    ),
    linker: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 14l4-4" {...common} />
        <path d="M7 17a3 3 0 010-4l3-3a3 3 0 014 4l-1 1" {...common} />
        <path d="M17 7a3 3 0 010 4l-3 3a3 3 0 01-4-4l1-1" {...common} />
      </svg>
    ),
    argument: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 5h12M6 10h12M6 15h8M6 20h8" {...common} />
        <circle cx="18" cy="15" r="1.5" {...common} />
        <circle cx="18" cy="20" r="1.5" {...common} />
      </svg>
    ),
    datastore: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3" {...common} />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" {...common} />
      </svg>
    ),
    valuereplacer: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 8h8l-2-2M18 16h-8l2 2" {...common} />
        <path d="M14 8a4 4 0 014 4M10 16a4 4 0 01-4-4" {...common} />
      </svg>
    ),
    staticvariable: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="5" width="14" height="4" rx="1" {...common} />
        <rect x="5" y="10" width="14" height="4" rx="1" {...common} />
        <rect x="5" y="15" width="14" height="4" rx="1" {...common} />
      </svg>
    ),
    customtag: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 4H5v6l8 8 6-6-8-8z" {...common} />
        <circle cx="8" cy="8" r="1.5" {...common} />
      </svg>
    ),
    sqlconnector: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="8" cy="7" rx="4" ry="2" {...common} />
        <path d="M4 7v5c0 1.1 1.8 2 4 2s4-.9 4-2V7" {...common} />
        <path d="M14 9h3M17 9l2 2-2 2M14 15h3M17 15l2 2-2 2" {...common} />
      </svg>
    ),
    plctag: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="2" {...common} />
        <path d="M3 10h3M3 14h3M18 10h3M18 14h3M10 3v3M14 3v3M10 18v3M14 18v3" {...common} />
      </svg>
    ),
    message: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" {...common} />
        <path d="M4 8l8 6 8-6" {...common} />
      </svg>
    ),
    flow: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="6" r="2" {...common} />
        <circle cx="18" cy="6" r="2" {...common} />
        <circle cx="12" cy="18" r="2" {...common} />
        <path d="M8 6h8M7.5 7.5l3.5 8M16.5 7.5l-3.5 8" {...common} />
      </svg>
    ),
  }

  const icon = iconByKey[key]
  if (icon) return icon
  return <span className="icon-fallback">{fallback || '?'}</span>
}

