import { useState } from 'react'
import type { Cp } from '../types'

interface Props {
  cp: Cp
  onSave: (cp: Cp) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function CPEditModal({ cp, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState({
    number: cp.number,
    usage: cp.usage as Cp['usage'],
    score: cp.score,
    description: cp.description,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 320, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>CP編集</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>種別</label>
          <select value={form.usage}
            onChange={e => setForm(f => ({ ...f, usage: e.target.value as Cp['usage'] }))}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}>
            <option value="start">スタート (S)</option>
            <option value="cp">CP</option>
            <option value="goal">フィニッシュ (F)</option>
            <option value="both">スタート兼フィニッシュ</option>
          </select>
        </div>

        {form.usage === 'cp' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>CP番号</label>
            <input type="number" value={form.number} min={1}
              onChange={e => setForm(f => ({ ...f, number: Number(e.target.value) }))}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }} />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>得点</label>
          <input type="number" value={form.score} min={0}
            onChange={e => setForm(f => ({ ...f, score: Number(e.target.value) }))}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>説明</label>
          <textarea value={form.description} rows={2}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, resize: 'vertical', fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 16, fontSize: 11, color: '#888' }}>
          座標: {cp.coordinates[1].toFixed(6)}, {cp.coordinates[0].toFixed(6)}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { onDelete(cp.id); onClose() }}
            style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            削除
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
            style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            キャンセル
          </button>
          <button onClick={() => { onSave({ ...cp, ...form }); onClose() }}
            style={{ padding: '8px 16px', background: '#2d6a4f', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
