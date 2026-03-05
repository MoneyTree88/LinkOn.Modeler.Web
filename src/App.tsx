import { type ChangeEvent, useCallback, useMemo, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import './App.css'
import { GraphView } from './components/GraphView'
import { buildQmf, getDriverSummary, parseQmf, type QmfDocument } from './lib/qmf'
import { validateQmf } from './lib/validate'
import { MessageEditor } from './components/MessageEditor'
import { FlowEditor } from './components/FlowEditor'
import { RibbonBar, type RibbonButton, type RibbonSection } from './components/RibbonBar'
import { OptionDialog } from './components/OptionDialog'

type LoadState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; fileName: string; doc: QmfDocument }

type View = 'blank' | 'summary' | 'message' | 'flow'

function App() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [view, setView] = useState<View>('blank')
  const [showOption, setShowOption] = useState(false)
  const [treeFontFamily, setTreeFontFamily] = useState<string>('Noto Sans KR, Noto Sans, Segoe UI, system-ui, sans-serif')
  const [treeFontSize, setTreeFontSize] = useState<number>(14)
  const [propFontFamily, setPropFontFamily] = useState<string>('Noto Sans KR, Noto Sans, Segoe UI, system-ui, sans-serif')
  const [propFontSize, setPropFontSize] = useState<number>(14)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleOpen = useCallback(() => fileInputRef.current?.click(), [])
  const handleHome = useCallback(() => {
    if (state.status !== 'loaded') return
    setView('summary')
  }, [state.status])

  const handleNew = useCallback(async () => {
    try {
      const res = await fetch('/templates/New_Default.qmf')
      if (!res.ok) throw new Error(`Template load failed (${res.status})`)
      const text = await res.text()
      const doc = parseQmf(text)
      setState({ status: 'loaded', fileName: 'New_Default.qmf', doc })
      setView('summary')
    } catch (err: any) {
      setState({ status: 'error', message: err?.message ?? 'Template load failed' })
      setView('blank')
    }
  }, [])

  const openFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.qmf')) {
      alert('.qmf 파일만 열 수 있습니다.')
      return
    }
    try {
      const text = await file.text()
      const doc = parseQmf(text)
      setState({ status: 'loaded', fileName: file.name, doc })
      setView('summary')
    } catch (err: any) {
      setState({ status: 'error', message: err?.message ?? 'Parse failed' })
      setView('blank')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  const onFileChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0]
      if (!file) return
      void openFile(file)
    },
    [openFile]
  )

  const handleDownload = useCallback(() => {
    if (state.status !== 'loaded') return
    const xml = buildQmf(state.doc.data)
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    saveAs(blob, state.fileName || 'model.qmf')
  }, [state])

  const handleSaveAs = useCallback(async () => {
    if (state.status !== 'loaded') return
    const xml = buildQmf(state.doc.data)
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })

    if (typeof (window as any).showSaveFilePicker === 'function') {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: state.fileName || 'model.qmf',
          types: [{ description: 'QMF / XML', accept: { 'application/xml': ['.qmf', '.xml'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        setState((prev) => (prev.status === 'loaded' ? { ...prev, fileName: handle.name } : prev))
        return
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.warn('showSaveFilePicker failed, fallback to download', err)
      }
    }

    const newName = window.prompt('파일 이름을 입력하세요.', state.fileName || 'model.qmf')
    if (!newName) return
    saveAs(blob, newName)
    setState((prev) => (prev.status === 'loaded' ? { ...prev, fileName: newName } : prev))
  }, [state])

  const updateDoc = useCallback(
    (mutator: (draft: any) => void) => {
      setState((prev) => {
        if (prev.status !== 'loaded') return prev
        const cloned = structuredClone(prev.doc.data)
        mutator(cloned)
        const xml = buildQmf(cloned)
        return { status: 'loaded', fileName: prev.fileName, doc: { data: cloned, rawXml: xml } }
      })
    },
    []
  )

  const updateDocFast = useCallback(
    (mutator: (draft: any) => void) => {
      setState((prev) => {
        if (prev.status !== 'loaded') return prev
        const cloned = structuredClone(prev.doc.data)
        mutator(cloned)
        return { status: 'loaded', fileName: prev.fileName, doc: { data: cloned, rawXml: prev.doc.rawXml } }
      })
    },
    []
  )

  const summary = useMemo(() => {
    if (state.status !== 'loaded') return null
    return getDriverSummary(state.doc.data)
  }, [state])

  const validation = useMemo(() => {
    if (state.status !== 'loaded') return []
    return validateQmf(state.doc.data)
  }, [state])

  const ribbonSections = useMemo((): RibbonSection[] => {
    const fileButtons: RibbonButton[] = [
      { label: 'New', icon: 'N', onClick: handleNew, disabled: false },
      { label: 'Open', icon: 'O', onClick: handleOpen },
      { label: 'Home', icon: 'H', onClick: handleHome, disabled: state.status !== 'loaded' },
      { label: 'Save', icon: 'S', onClick: handleDownload, disabled: state.status !== 'loaded' },
      { label: 'Save As', icon: 'A', onClick: handleSaveAs, disabled: state.status !== 'loaded' },
      { label: 'Option', icon: 'P', onClick: () => setShowOption(true) },
    ]
    const declButtons: RibbonButton[] = [
      { label: 'Linker', icon: 'L', disabled: true },
      { label: 'Argument', icon: 'A', disabled: true },
      { label: 'Data Store', icon: 'D', disabled: true },
      { label: 'Value Replacer', icon: 'V', disabled: true },
      { label: 'Static Variable', icon: 'S', disabled: true },
      { label: 'Custom Tag', icon: 'C', disabled: true },
      { label: 'Sql Connector', icon: 'Q', disabled: true },
      { label: 'Plc Tag', icon: 'P', disabled: true },
    ]
    const devButtons: RibbonButton[] = [
      { label: 'Message', icon: 'M', onClick: () => setView('message'), disabled: state.status !== 'loaded' },
      { label: 'Flow', icon: 'F', onClick: () => setView('flow'), disabled: state.status !== 'loaded' },
    ]
    return [
      { title: 'File', buttons: fileButtons },
      { title: 'Declaration', buttons: declButtons, collapsible: true, defaultCollapsed: true },
      { title: 'Development', buttons: devButtons },
    ]
  }, [handleDownload, handleOpen, handleSaveAs, handleNew, handleHome, state.status])

  return (
    <div className="page">
      <RibbonBar sections={ribbonSections} />
      <input ref={fileInputRef} type="file" accept=".qmf,.xml" style={{ display: 'none' }} onChange={onFileChange} />

      <div className={`file-banner ${state.status === 'loaded' ? '' : 'empty'}`}>
        <div className="file-pill">
          <span className="dot" />
          <span className="label">현재 파일</span>
          <strong>{state.status === 'loaded' ? state.fileName : '아직 모델링 파일 없음'}</strong>
        </div>
        {state.status === 'loaded' && summary && (
          <div className="file-meta">
            <span>
              Driver: <strong>{summary.name || '-'}</strong>
            </span>
            <span>
              Messages: <strong>{summary.countMessages ?? 0}</strong>
            </span>
            <span>
              Flows: <strong>{summary.countFlows ?? 0}</strong>
            </span>
          </div>
        )}
      </div>

      <main>
        {view === 'blank' && (
          <div className="blank-state">리본 메뉴에서 기능을 선택하거나 .qmf 파일을 불러와 주세요.</div>
        )}

        {view === 'summary' && state.status === 'loaded' && (
          <>
            <section className="panel">
              <div className="grid two">
                <div>
                  <h3>파일 정보</h3>
                  <ul className="meta">
                    <li>
                      <span>파일명</span>
                      <strong>{state.fileName}</strong>
                    </li>
                    <li>
                      <span>Driver 이름</span>
                      <strong>{summary?.name ?? '-'}</strong>
                    </li>
                    <li>
                      <span>Driver 버전</span>
                      <strong>{summary?.version ?? '-'}</strong>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3>구성 통계</h3>
                  <ul className="meta">
                    <li>
                      <span>Messages</span>
                      <strong>{summary?.countMessages ?? 0}</strong>
                    </li>
                    <li>
                      <span>Flows</span>
                      <strong>{summary?.countFlows ?? 0}</strong>
                    </li>
                    <li>
                      <span>ValueReplacer Sets</span>
                      <strong>{summary?.countValueSets ?? 0}</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>검증 결과</h3>
              {validation.length === 0 ? (
                <p>문제가 발견되지 않았습니다.</p>
              ) : (
                <ul className="issues">
                  {validation.map((v, i) => (
                    <li key={i} className={v.severity}>
                      <strong>{v.severity.toUpperCase()}</strong> {v.message} <span className="path">{v.path}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h3>Model Overview</h3>
              <GraphView data={state.doc.data} />
            </section>

            <section className="panel">
              <h3>원본 XML (미리보기)</h3>
              <pre className="code">{state.doc.rawXml.slice(0, 4000)}</pre>
            </section>
          </>
        )}

        {view === 'message' && state.status === 'loaded' && (
          <div id="message-editor">
            <MessageEditor
              data={state.doc.data}
              onChange={updateDoc}
              onChangeFast={updateDocFast}
              treeFontFamily={treeFontFamily}
              treeFontSize={treeFontSize}
              propLabelFontFamily={propFontFamily}
              propLabelFontSize={propFontSize}
            />
          </div>
        )}

        {view === 'flow' && state.status === 'loaded' && (
          <div id="flow-editor">
            <FlowEditor data={state.doc.data} treeFontFamily={treeFontFamily} treeFontSize={treeFontSize} />
          </div>
        )}

        {state.status === 'error' && (
          <div className="panel error">
            <strong>로딩 오류:</strong> {state.message}
          </div>
        )}
      </main>

      {showOption && (
        <OptionDialog
          initialTreeFont={treeFontFamily}
          initialTreeSize={treeFontSize}
          initialPropFont={propFontFamily}
          initialPropSize={propFontSize}
          onCancel={() => setShowOption(false)}
          onApply={(vals) => {
            setTreeFontFamily(vals.treeFont)
            setTreeFontSize(vals.treeSize)
            setPropFontFamily(vals.propFont)
            setPropFontSize(vals.propSize)
            setShowOption(false)
          }}
        />
      )}
    </div>
  )
}

export default App


