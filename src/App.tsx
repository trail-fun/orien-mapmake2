import { useState } from 'react'
import { useProjectStore } from './store/projectStore'
import { parseS2Zip } from './lib/parseS2Zip'
import { promoteCandidateToCp } from './lib/utils'
import MapView from './components/MapView/MapView'
import CPEditModal from './components/CPEditModal'
import CPPanel from './components/CPPanel'
import type { Cp, CpCandidate } from './types'

type ModalState =
  | { type: 'none' }
  | { type: 'cp-edit'; cp: Cp }
  | { type: 'cp-candidate'; candidate: CpCandidate }

export default function App() {
  const { project, setProject, clearProject, updateCp, deleteCp, addCp } = useProjectStore()
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [panelOpen, setPanelOpen] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number]>([136.0, 36.0])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const parsed = await parseS2Zip(file)
      setProject(parsed)
    } catch (err) {
      alert(`読み込みエラー: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleCpSave = (cp: Cp) => { updateCp(cp); setModal({ type: 'none' }) }
  const handleCpDelete = (id: string) => { deleteCp(id); setModal({ type: 'none' }) }

  const handlePromote = (candidate: CpCandidate) => {
    if (!project) return
    const newCp = promoteCandidateToCp(candidate, project.cps)
    addCp(newCp)
    setModal({ type: 'cp-edit', cp: newCp })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#1a3a2a', color: 'white', flexShrink: 0, gap: 12,
      }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>orien-mapmake2</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {project && <span style={{ fontSize: 13, opacity: 0.8 }}>{project.metadata.area_name}</span>}
          {project && (
            <button onClick={clearProject} style={btn('#444', 'white')}>✕ クリア</button>
          )}
          <label style={{ ...btn('#2d6a4f', 'white'), cursor: 'pointer' }}>
            📂 S2データ読込
            <input type="file" accept=".zip" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </header>

      {/* Map or empty state */}
      {project ? (
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView
            project={project}
            onCpEdit={cp => setModal({ type: 'cp-edit', cp })}
            onCpCandidateClick={c => setModal({ type: 'cp-candidate', candidate: c })}
            onCenterChange={setMapCenter}
          />
          <CPPanel
            open={panelOpen}
            onToggle={() => setPanelOpen(o => !o)}
            onEdit={cp => setModal({ type: 'cp-edit', cp })}
            mapCenter={mapCenter}
          />
          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 24, left: 12, background: 'white',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            lineHeight: 1.8, pointerEvents: 'none',
          }}>
            <div><span style={{ color: '#888' }}>●</span> CP候補（クリックで昇格）</div>
            <div><span style={{ color: '#c0392b' }}>●</span> 設置CP（クリック選択・ダブルクリック編集）</div>
            <div style={{ color: '#666', marginTop: 4 }}>
              CP: {project.cps.length} / 候補: {project.cpCandidates.length}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: '#f8f9fa', color: '#555',
        }}>
          <div style={{ fontSize: 48 }}>🗺️</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>サービス3: 競技地図作成</div>
          <div style={{ fontSize: 14, color: '#888' }}>サービス2でエクスポートした ZIP ファイルを読み込んでください</div>
          <label style={{ ...btn('#2d6a4f', 'white'), fontSize: 15, padding: '10px 24px', cursor: 'pointer' }}>
            📂 S2データ読込
            <input type="file" accept=".zip" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {/* Modals */}
      {modal.type === 'cp-edit' && (
        <CPEditModal cp={modal.cp} onSave={handleCpSave} onDelete={handleCpDelete} onClose={() => setModal({ type: 'none' })} />
      )}

      {modal.type === 'cp-candidate' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 300, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>CP候補の昇格</h3>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              <strong>CP {modal.candidate.number}</strong> ({modal.candidate.usage})
            </div>
            {modal.candidate.memo && (
              <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>{modal.candidate.memo}</div>
            )}
            <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
              このCP候補を確定CPとして追加しますか？
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal({ type: 'none' })}
                style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                キャンセル
              </button>
              <button onClick={() => { handlePromote(modal.candidate); }}
                style={{ padding: '8px 16px', background: '#2d6a4f', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function btn(bg: string, color: string): React.CSSProperties {
  return {
    background: bg, color, border: 'none', borderRadius: 6,
    padding: '6px 12px', fontSize: 13, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }
}
