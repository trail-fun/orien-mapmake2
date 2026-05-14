import { useProjectStore, type LatLng } from '../store/projectStore'
import type { MapImageCorners } from '../types'

const KEYS = ['top_left', 'top_right', 'bottom_right', 'bottom_left'] as const

function imgStep(c: MapImageCorners): number {
  const w = Math.hypot(c.top_right.lat - c.top_left.lat, c.top_right.lng - c.top_left.lng)
  const h = Math.hypot(c.bottom_left.lat - c.top_left.lat, c.bottom_left.lng - c.top_left.lng)
  return Math.min(w, h) * 0.03
}

function scaleAroundPivot(c: MapImageCorners, factor: number, pivot: LatLng): MapImageCorners {
  const result = {} as MapImageCorners
  for (const k of KEYS) {
    result[k] = {
      lat: pivot.lat + factor * (c[k].lat - pivot.lat),
      lng: pivot.lng + factor * (c[k].lng - pivot.lng),
    }
  }
  return result
}

function rotateAroundPivot(c: MapImageCorners, angleDeg: number, pivot: LatLng): MapImageCorners {
  const a = angleDeg * Math.PI / 180
  const cosA = Math.cos(a), sinA = Math.sin(a)
  const cosLat = Math.cos(pivot.lat * Math.PI / 180)
  const result = {} as MapImageCorners
  for (const k of KEYS) {
    const x = (c[k].lng - pivot.lng) * cosLat
    const y = c[k].lat - pivot.lat
    result[k] = {
      lat: pivot.lat + (x * sinA + y * cosA),
      lng: pivot.lng + (x * cosA - y * sinA) / cosLat,
    }
  }
  return result
}

export default function BasemapAdjustPanel() {
  const { basemap, updateBasemapCorners, basemapPivot, setBasemapPivot } = useProjectStore()
  if (!basemap || !basemapPivot) return null

  const step = imgStep(basemap.corners)
  const cosLat = Math.cos(basemapPivot.lat * Math.PI / 180)
  const lngStep = step / cosLat

  const movePivot = (dlat: number, dlng: number) =>
    setBasemapPivot({ lat: basemapPivot.lat + dlat, lng: basemapPivot.lng + dlng })

  const applyCorners = (fn: (c: MapImageCorners) => MapImageCorners) =>
    updateBasemapCorners(fn(basemap.corners))

  const iconBtn = (icon: string, onClick: () => void) => (
    <button onClick={onClick} style={{
      width: 34, height: 34, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'white', border: '1px solid #ccc',
      borderRadius: 6, cursor: 'pointer', fontSize: 17, userSelect: 'none',
    }}>
      {icon}
    </button>
  )

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 10, color: '#888', textAlign: 'center', marginTop: 2 }}>{text}</div>
  )

  return (
    <div style={{
      position: 'absolute', top: 10, left: 10, zIndex: 10,
      background: 'rgba(255,255,255,0.95)', borderRadius: 10,
      padding: '8px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 11, color: '#333', fontWeight: 700, textAlign: 'center', marginBottom: 2 }}>
        ベースマップ調整
      </div>

      {/* 十字移動 */}
      {sectionLabel('十字移動')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 3 }}>
        <span />
        {iconBtn('↑', () => movePivot(step, 0))}
        <span />
        {iconBtn('←', () => movePivot(0, -lngStep))}
        <span />
        {iconBtn('→', () => movePivot(0, lngStep))}
        <span />
        {iconBtn('↓', () => movePivot(-step, 0))}
        <span />
      </div>

      {/* 拡縮（十字基点） */}
      {sectionLabel('拡縮')}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
        {iconBtn('＋', () => applyCorners(c => scaleAroundPivot(c, 1.03, basemapPivot)))}
        {iconBtn('－', () => applyCorners(c => scaleAroundPivot(c, 1 / 1.03, basemapPivot)))}
      </div>

      {/* 回転（十字基点、0.2°刻み） */}
      {sectionLabel('回転')}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
        {iconBtn('↺', () => applyCorners(c => rotateAroundPivot(c, 0.2, basemapPivot)))}
        {iconBtn('↻', () => applyCorners(c => rotateAroundPivot(c, -0.2, basemapPivot)))}
      </div>
    </div>
  )
}
