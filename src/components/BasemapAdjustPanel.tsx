import { useProjectStore } from '../store/projectStore'
import type { MapImageCorners } from '../types'

const KEYS = ['top_left', 'top_right', 'bottom_right', 'bottom_left'] as const

function calcCenter(c: MapImageCorners) {
  return {
    lat: (c.top_left.lat + c.top_right.lat + c.bottom_right.lat + c.bottom_left.lat) / 4,
    lng: (c.top_left.lng + c.top_right.lng + c.bottom_right.lng + c.bottom_left.lng) / 4,
  }
}

function imgStep(c: MapImageCorners): number {
  const w = Math.hypot(c.top_right.lat - c.top_left.lat, c.top_right.lng - c.top_left.lng)
  const h = Math.hypot(c.bottom_left.lat - c.top_left.lat, c.bottom_left.lng - c.top_left.lng)
  return Math.min(w, h) * 0.03
}

function translate(c: MapImageCorners, dlat: number, dlng: number): MapImageCorners {
  return {
    top_left:     { lat: c.top_left.lat + dlat,     lng: c.top_left.lng + dlng },
    top_right:    { lat: c.top_right.lat + dlat,    lng: c.top_right.lng + dlng },
    bottom_right: { lat: c.bottom_right.lat + dlat, lng: c.bottom_right.lng + dlng },
    bottom_left:  { lat: c.bottom_left.lat + dlat,  lng: c.bottom_left.lng + dlng },
  }
}

function scaleCorners(c: MapImageCorners, factor: number): MapImageCorners {
  const ctr = calcCenter(c)
  const result = {} as MapImageCorners
  for (const k of KEYS) {
    result[k] = {
      lat: ctr.lat + factor * (c[k].lat - ctr.lat),
      lng: ctr.lng + factor * (c[k].lng - ctr.lng),
    }
  }
  return result
}

function rotate(c: MapImageCorners, angleDeg: number): MapImageCorners {
  const ctr = calcCenter(c)
  const a = angleDeg * Math.PI / 180
  const cosA = Math.cos(a), sinA = Math.sin(a)
  const cosLat = Math.cos(ctr.lat * Math.PI / 180)
  const result = {} as MapImageCorners
  for (const k of KEYS) {
    const x = (c[k].lng - ctr.lng) * cosLat
    const y = c[k].lat - ctr.lat
    result[k] = {
      lat: ctr.lat + (x * sinA + y * cosA),
      lng: ctr.lng + (x * cosA - y * sinA) / cosLat,
    }
  }
  return result
}

export default function BasemapAdjustPanel() {
  const { basemap, updateBasemapCorners } = useProjectStore()
  if (!basemap) return null

  const step = imgStep(basemap.corners)
  const ctr = calcCenter(basemap.corners)
  const lngStep = step / Math.cos(ctr.lat * Math.PI / 180)
  const apply = (fn: (c: MapImageCorners) => MapImageCorners) =>
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

      {/* 移動 */}
      {sectionLabel('移動')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 3 }}>
        <span />
        {iconBtn('↑', () => apply(c => translate(c, step, 0)))}
        <span />
        {iconBtn('←', () => apply(c => translate(c, 0, -lngStep)))}
        <span />
        {iconBtn('→', () => apply(c => translate(c, 0, lngStep)))}
        <span />
        {iconBtn('↓', () => apply(c => translate(c, -step, 0)))}
        <span />
      </div>

      {/* 拡縮 */}
      {sectionLabel('拡縮')}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
        {iconBtn('＋', () => apply(c => scaleCorners(c, 1.03)))}
        {iconBtn('－', () => apply(c => scaleCorners(c, 1 / 1.03)))}
      </div>

      {/* 回転 */}
      {sectionLabel('回転')}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
        {iconBtn('↺', () => apply(c => rotate(c, 1)))}
        {iconBtn('↻', () => apply(c => rotate(c, -1)))}
      </div>
    </div>
  )
}
