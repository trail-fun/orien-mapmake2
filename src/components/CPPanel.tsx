import type { Cp } from '../types'
import { useProjectStore } from '../store/projectStore'
import { sortByOrder, cpLabel, generateId } from '../lib/utils'

interface Props {
  open: boolean
  onToggle: () => void
  onEdit: (cp: Cp) => void
  mapCenter: [number, number]
}

export default function CPPanel({ open, onToggle, onEdit, mapCenter }: Props) {
  const { project, addCp, deleteCp, updateCps, setSelectedCpId, selectedCpId } = useProjectStore()
  if (!project) return null

  const sorted = sortByOrder(project.cps)
  const cpOnly = sorted.filter(c => c.usage === 'cp')

  const handleMoveUp = (cp: Cp) => {
    const i = cpOnly.findIndex(c => c.id === cp.id)
    if (i <= 0) return
    const arr = [...cpOnly]
    ;[arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]
    const reordered = arr.map((c, idx) => ({ ...c, order: idx + 1 }))
    updateCps(project.cps.map(c => reordered.find(r => r.id === c.id) ?? c))
  }

  const handleMoveDown = (cp: Cp) => {
    const i = cpOnly.findIndex(c => c.id === cp.id)
    if (i < 0 || i >= cpOnly.length - 1) return
    const arr = [...cpOnly]
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    const reordered = arr.map((c, idx) => ({ ...c, order: idx + 1 }))
    updateCps(project.cps.map(c => reordered.find(r => r.id === c.id) ?? c))
  }

  const handleAddCp = () => {
    const maxNum = cpOnly.length > 0 ? Math.max(...cpOnly.map(c => c.number)) : 0
    const maxOrd = cpOnly.length > 0 ? Math.max(...cpOnly.map(c => c.order)) : 0
    const id = generateId('cp_', project.cps.map(c => c.id))
    const now = new Date().toISOString()
    const newCp: Cp = {
      id, type: 'cp', number: maxNum + 1, usage: 'cp', order: maxOrd + 1,
      score: 10, acquired_lat: mapCenter[1], acquired_lng: mapCenter[0],
      acquired_at: now, description: '', memo: '', photos: [],
      coordinates: [...mapCenter] as [number, number],
    }
    addCp(newCp)
    setSelectedCpId(id)
    onEdit(newCp)
  }

  const confirmDelete = (cp: Cp) => {
    if (window.confirm(`${cpLabel(cp.number, cp.usage)} を削除しますか？`)) deleteCp(cp.id)
  }

  return (
    <>
      {/* Toggle button */}
      <button onClick={onToggle} style={{
        position: 'absolute', top: 12, right: open ? 272 : 12, zIndex: 50,
        background: 'white', border: '1px solid #ddd', borderRadius: 8,
        padding: '6px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        {open ? '▶ 閉じる' : '☰ CP一覧'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 260,
          background: 'white', borderLeft: '1px solid #ddd', zIndex: 40,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 12px 8px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid #eee', flexShrink: 0 }}>
            CP一覧 ({sorted.length})
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
            {sorted.map(cp => {
              const isCpType = cp.usage === 'cp'
              const idxInCpOnly = cpOnly.findIndex(c => c.id === cp.id)
              return (
                <div key={cp.id}
                  onClick={() => setSelectedCpId(cp.id === selectedCpId ? null : cp.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px',
                    borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                    background: cp.id === selectedCpId ? '#fef9e7' : 'transparent',
                    borderLeft: cp.id === selectedCpId ? '3px solid #f59e0b' : '3px solid transparent',
                  }}>
                  {/* Badge */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    border: '2px solid #c0392b',
                    background: cp.usage === 'start' ? '#c0392b' : 'transparent',
                    color: cp.usage === 'start' ? 'white' : '#c0392b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {cpLabel(cp.number, cp.usage)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cp.usage === 'start' ? 'スタート' : cp.usage === 'goal' ? 'フィニッシュ' : cp.usage === 'both' ? 'S/F' : `CP ${cp.number}`}
                    </div>
                    {cp.description && (
                      <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cp.description}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                    {isCpType && (
                      <>
                        <button onClick={e => { e.stopPropagation(); handleMoveUp(cp) }}
                          disabled={idxInCpOnly === 0}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 3px', opacity: idxInCpOnly === 0 ? 0.3 : 1, fontSize: 13 }}>↑</button>
                        <button onClick={e => { e.stopPropagation(); handleMoveDown(cp) }}
                          disabled={idxInCpOnly === cpOnly.length - 1}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 3px', opacity: idxInCpOnly === cpOnly.length - 1 ? 0.3 : 1, fontSize: 13 }}>↓</button>
                      </>
                    )}
                    <button onClick={e => { e.stopPropagation(); onEdit(cp) }}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#2d6a4f', fontSize: 12, fontWeight: 600 }}>編</button>
                    <button onClick={e => { e.stopPropagation(); confirmDelete(cp) }}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#dc2626', fontSize: 13, fontWeight: 700 }}>✕</button>
                  </div>
                </div>
              )
            })}
            {sorted.length === 0 && (
              <div style={{ color: '#888', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>CPがありません</div>
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid #eee', flexShrink: 0 }}>
            <button onClick={handleAddCp} style={{
              width: '100%', padding: 8, background: '#2d6a4f', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
              + CP追加（地図中心に配置）
            </button>
          </div>
        </div>
      )}
    </>
  )
}
