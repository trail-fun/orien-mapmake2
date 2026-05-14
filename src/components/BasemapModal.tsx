import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { pdfToDataUrl } from '../lib/pdfUtils'
import type { MapImageCorners, PrintInfo } from '../types'

interface Props {
  onClose: () => void
  print?: PrintInfo
}

type Corner = keyof MapImageCorners

const CORNER_LABELS: { key: Corner; label: string }[] = [
  { key: 'top_left', label: '左上' },
  { key: 'top_right', label: '右上' },
  { key: 'bottom_left', label: '左下' },
  { key: 'bottom_right', label: '右下' },
]

function defaultCorners(print?: PrintInfo): MapImageCorners {
  if (print) {
    const [west, south, east, north] = print.bbox
    return {
      top_left:     { lat: north, lng: west },
      top_right:    { lat: north, lng: east },
      bottom_right: { lat: south, lng: east },
      bottom_left:  { lat: south, lng: west },
    }
  }
  return {
    top_left:     { lat: 35.010, lng: 135.001 },
    top_right:    { lat: 35.010, lng: 135.010 },
    bottom_right: { lat: 35.001, lng: 135.010 },
    bottom_left:  { lat: 35.001, lng: 135.001 },
  }
}

export default function BasemapModal({ onClose, print }: Props) {
  const { basemap, setBasemap } = useProjectStore()

  const [previewUrl, setPreviewUrl] = useState<string | null>(basemap?.url ?? null)
  const [corners, setCorners] = useState<MapImageCorners>(
    basemap?.corners ?? defaultCorners(print)
  )
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)
    setConverting(true)
    try {
      const url = await pdfToDataUrl(file)
      setPreviewUrl(url)
    } catch (err) {
      setError(`PDF変換エラー: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setConverting(false)
    }
  }

  const setCorner = (key: Corner, field: 'lat' | 'lng', value: string) => {
    const num = parseFloat(value)
    setCorners(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: isNaN(num) ? prev[key][field] : num },
    }))
  }

  const handleApply = () => {
    if (!previewUrl) return
    setBasemap({ url: previewUrl, corners })
    onClose()
  }

  const handleDelete = () => {
    setBasemap(null)
    onClose()
  }

  const handleFillFromBbox = () => {
    if (print) setCorners(defaultCorners(print))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, width: 480,
        maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>PDFベースマップ設定</h3>

        {/* PDF file picker */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>PDFファイル</div>
          {converting ? (
            <div style={{ padding: '12px 0', color: '#888', fontSize: 13 }}>変換中...</div>
          ) : previewUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={previewUrl} alt="preview"
                style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 4 }} />
              <label style={{ fontSize: 13, color: '#2d6a4f', cursor: 'pointer', textDecoration: 'underline' }}>
                変更
                <input type="file" accept=".pdf" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            </div>
          ) : (
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed #ccc', borderRadius: 8, padding: '20px 0',
              cursor: 'pointer', color: '#888', fontSize: 13, gap: 6,
            }}>
              📄 PDFファイルを選択
              <input type="file" accept=".pdf" onChange={handleFile} style={{ display: 'none' }} />
            </label>
          )}
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{error}</div>}
        </div>

        {/* Corner coordinates */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>四隅の緯度経度</span>
            {print && (
              <button onClick={handleFillFromBbox} style={{
                fontSize: 11, color: '#2d6a4f', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', padding: 0,
              }}>
                印刷範囲から自動入力
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {CORNER_LABELS.map(({ key, label }) => (
              <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#444', marginBottom: 6 }}>{label}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <label style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>緯度 (lat)</div>
                    <input
                      type="number" step="0.000001"
                      value={corners[key].lat}
                      onChange={e => setCorner(key, 'lat', e.target.value)}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>経度 (lng)</div>
                    <input
                      type="number" step="0.000001"
                      value={corners[key].lng}
                      onChange={e => setCorner(key, 'lng', e.target.value)}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {basemap && (
            <button onClick={handleDelete} style={{
              padding: '8px 12px', background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 13,
            }}>
              削除
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd',
            borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}>
            キャンセル
          </button>
          <button onClick={handleApply} disabled={!previewUrl} style={{
            padding: '8px 16px', background: previewUrl ? '#2d6a4f' : '#ccc',
            color: 'white', border: 'none', borderRadius: 6, cursor: previewUrl ? 'pointer' : 'default',
            fontSize: 13, fontWeight: 600,
          }}>
            地図に適用
          </button>
        </div>
      </div>
    </div>
  )
}
