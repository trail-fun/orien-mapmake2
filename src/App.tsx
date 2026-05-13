import { useProjectStore } from './store/projectStore'
import { parseS2Zip } from './lib/parseS2Zip'
import MapView from './components/MapView/MapView'

export default function App() {
  const { project, setProject, clearProject } = useProjectStore()

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#1a3a2a', color: 'white', flexShrink: 0,
        gap: 12,
      }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>orien-mapmake2</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {project && (
            <span style={{ fontSize: 13, opacity: 0.8 }}>{project.metadata.area_name}</span>
          )}
          {project && (
            <button onClick={clearProject} style={btnStyle('#444', 'white')}>✕ クリア</button>
          )}
          <label style={{ ...btnStyle('#2d6a4f', 'white'), cursor: 'pointer' }}>
            📂 S2データ読込
            <input type="file" accept=".zip" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </header>

      {/* Map or empty state */}
      {project ? (
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView project={project} />
          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 24, left: 12, background: 'white',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            lineHeight: 1.8, pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>凡例</div>
            <div><span style={{ color: '#888' }}>●</span> CP候補（グレー）</div>
            <div><span style={{ color: '#c0392b' }}>●</span> 設置CP（赤）</div>
            <div><span style={{ color: '#2d6a4f' }}>─ ─</span> 印刷範囲</div>
            <div style={{ marginTop: 4, color: '#666' }}>
              CP: {project.cps.length} / 候補: {project.cpCandidates.length} / メモ: {project.surveyMemos.length}
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
          <div style={{ fontSize: 14, color: '#888' }}>
            サービス2でエクスポートした ZIP ファイルを読み込んでください
          </div>
          <label style={{ ...btnStyle('#2d6a4f', 'white'), fontSize: 15, padding: '10px 24px', cursor: 'pointer' }}>
            📂 S2データ読込
            <input type="file" accept=".zip" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      )}
    </div>
  )
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg, color, border: 'none', borderRadius: 6,
    padding: '6px 12px', fontSize: 13, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }
}
