import { useState } from 'react'
import { useProjectStore, type LatLng } from '../store/projectStore'
import type { MapImageCorners } from '../types'

const KEYS = ['top_left', 'top_right', 'bottom_right', 'bottom_left'] as const

function imgStep(c: MapImageCorners): number {
  const w = Math.hypot(c.top_right.lat - c.top_left.lat, c.top_right.lng - c.top_left.lng)
  const h = Math.hypot(c.bottom_left.lat - c.top_left.lat, c.bottom_left.lng - c.top_left.lng)
  return Math.min(w, h) * 0.03
}

function translateCorners(c: MapImageCorners, dlat: number, dlng: number): MapImageCorners {
  return {
    top_left:     { lat: c.top_left.lat + dlat,     lng: c.top_left.lng + dlng },
    top_right:    { lat: c.top_right.lat + dlat,    lng: c.top_right.lng + dlng },
    bottom_right: { lat: c.bottom_right.lat + dlat, lng: c.bottom_right.lng + dlng },
    bottom_left:  { lat: c.bottom_left.lat + dlat,  lng: c.bottom_left.lng + dlng },
  }
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

type MoveMode = 'both' | 'crosshair'

export default function BasemapAdjustPanel() {
  const { basemap, updateBasemapCorners, basemapPivot, setBasemapPivot } = useProjectStore()
  const [moveMode, setMoveMode] = useState<MoveMode>('both')

  if (!basemap || !basemapPivot) return null

  const step = imgStep(basemap.corners)
  const cosLat = Math.cos(basemapPivot.lat * Math.PI / 180)
  const lngStep = step / cosLat
  const activeStep = moveMode === 'crosshair' ? step / 10 : step
  const activeLngStep = moveMode === 'crosshair' ? lngStep / 10 : lngStep

  const move = (dlat: number, dlng: number) => {
    if (moveMode === 'both') {
      updateBasemapCorners(translateCorners(basemap.corners, dlat, dlng))
      setBasemapPivot({ lat: basemapPivot.lat + dlat, lng: basemapPivot.lng + dlng })
    } else {
      setBasemapPivot({ lat: basemapPivot.lat + dlat, lng: basemapPivot.lng + dlng })
    }
  }

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

  const tabBtn = (label: string, mode: MoveMode) => (
    <button
      onClick={() => setMoveMode(mode)}
      style={{
        flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600,
        background: moveMode === mode ? '#1a3a2a' : '#f0f0f0',
        color: moveMode === mode ? 'white' : '#555',
        border: '1px solid #ccc', borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
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

      {/* 移動モード切替 */}
      {sectionLabel('移動対象')}
      <div style={{ display: 'flex', gap: 3 }}>
        {tabBtn('地図+十字', 'both')}
        {tabBtn('十字のみ', 'crosshair')}
      </div>

      {/* 移動ボタン */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 3 }}>
        <span />
        {iconBtn('↑', () => move(activeStep, 0))}
        <span />
        {iconBtn('←', () => move(0, -activeLngStep))}
        <span />
        {iconBtn('→', () => move(0, activeLngStep))}
        <span />
        {iconBtn('↓', () => move(-activeStep, 0))}
        <span />
      </div>

      {/* 拡縮（十字基点） */}
      {sectionLabel('拡縮')}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
        {iconBtn('＋', () => updateBasemapCorners(scaleAroundPivot(basemap.corners, 1.03, basemapPivot)))}
        {iconBtn('－', () => updateBasemapCorners(scaleAroundPivot(basemap.corners, 1 / 1.03, basemapPivot)))}
      </div>

      {/* 回転（十字基点、0.2°刻み） */}
      {sectionLabel('回転')}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
        {iconBtn('↺', () => updateBasemapCorners(rotateAroundPivot(basemap.corners, 0.2, basemapPivot)))}
        {iconBtn('↻', () => updateBasemapCorners(rotateAroundPivot(basemap.corners, -0.2, basemapPivot)))}
      </div>
    </div>
  )
}
