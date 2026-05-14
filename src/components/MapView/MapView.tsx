import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useProjectStore } from '../../store/projectStore'
import type { ProjectData, Cp, CpCandidate, SurveyMemo, PointStyle, LineStyle, AreaStyle, MapImageCorners } from '../../types'
import { sortByOrder, cpLabel } from '../../lib/utils'

interface Props {
  project: ProjectData
  onCpEdit: (cp: Cp) => void
  onCpCandidateClick: (c: CpCandidate) => void
  onCenterChange: (center: [number, number]) => void
}

const GSI_TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'

export default function MapView({ project, onCpEdit, onCpCandidateClick, onCenterChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const cpDragMarkerRef = useRef<maplibregl.Marker | null>(null)

  const { selectedCpId, setSelectedCpId, updateCp, basemap, updateBasemapCorners, basemapPivot, setBasemapPivot } = useProjectStore()

  const projectRef = useRef(project)
  projectRef.current = project
  const selectedCpIdRef = useRef(selectedCpId)
  selectedCpIdRef.current = selectedCpId
  const onCpEditRef = useRef(onCpEdit)
  onCpEditRef.current = onCpEdit
  const onCpCandidateClickRef = useRef(onCpCandidateClick)
  onCpCandidateClickRef.current = onCpCandidateClick
  const updateBasemapCornersRef = useRef(updateBasemapCorners)
  updateBasemapCornersRef.current = updateBasemapCorners
  const setBasemapPivotRef = useRef(setBasemapPivot)
  setBasemapPivotRef.current = setBasemapPivot
  const basemapPivotRef = useRef(basemapPivot)
  basemapPivotRef.current = basemapPivot

  const cpClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cpLastClickId = useRef<string | null>(null)
  const basemapMarkersRef = useRef<maplibregl.Marker[]>([])
  const basemapCenterMarkerRef = useRef<maplibregl.Marker | null>(null)

  // ---- map init ----
  useEffect(() => {
    if (!containerRef.current) return
    const bb = project.metadata.print.bbox
    const center: [number, number] = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { gsi: { type: 'raster', tiles: [GSI_TILE_URL], tileSize: 256, attribution: '© 国土地理院' } },
        layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }],
      },
      center,
      zoom: 14,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    map.on('move', () => {
      const c = map.getCenter()
      onCenterChange([c.lng, c.lat])
    })

    map.on('load', () => {
      initLayers(map)
      renderProject(map, projectRef.current)
    })

    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- re-render on project change ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    renderProject(map, project)
  }, [project])

  // ---- PDF basemap layer (URL変化時のみ再生成) ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (map.getLayer('basemap-hit-layer')) map.removeLayer('basemap-hit-layer')
    if (map.getLayer('basemap-layer')) map.removeLayer('basemap-layer')
    if (map.getSource('basemap-hit')) map.removeSource('basemap-hit')
    if (map.getSource('basemap')) map.removeSource('basemap')
    if (!basemap) return

    const { corners } = basemap
    // ラスターレイヤーはレイヤーイベント非対応のため、
    // 透明なポリゴンをヒットエリアとして重ねる
    map.addSource('basemap-hit', { type: 'geojson', data: cornersToPolygon(corners) })
    map.addSource('basemap', { type: 'image', url: basemap.url, coordinates: cornersToMapLibre(corners) })
    map.addLayer({ id: 'basemap-layer', type: 'raster', source: 'basemap',
      paint: { 'raster-opacity': 0.9 } }, 'print-bbox-fill')
    map.addLayer({ id: 'basemap-hit-layer', type: 'fill', source: 'basemap-hit',
      paint: { 'fill-opacity': 0 } }, 'print-bbox-fill')
  }, [basemap?.url]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- PDF basemap コーナードラッグ（縦横比固定）& 全体移動 ----
  useEffect(() => {
    basemapMarkersRef.current.forEach(m => m.remove())
    basemapMarkersRef.current = []

    const map = mapRef.current
    if (!map || !basemap) return

    const imgSrc = map.getSource('basemap') as maplibregl.ImageSource | undefined
    imgSrc?.setCoordinates(cornersToMapLibre(basemap.corners))
    ;(map.getSource('basemap-hit') as maplibregl.GeoJSONSource | undefined)
      ?.setData(cornersToPolygon(basemap.corners))

    const cornerKeys = ['top_left', 'top_right', 'bottom_right', 'bottom_left'] as const

    // ドラッグ中のリアルタイム座標（全ハンドラで共有）
    const liveCorners = deepCopyCorners(basemap.corners)
    // ドラッグ開始時点の座標（縦横比計算の基準）
    const origCorners = deepCopyCorners(basemap.corners)

    // 中心十字マーカー（ストアのピボット座標、またはコーナー中心で初期化）
    const initCenter = basemapPivotRef.current ?? calcCenter(basemap.corners)
    const crosshairEl = document.createElement('div')
    crosshairEl.style.cssText = 'position:relative;width:24px;height:24px;pointer-events:none;'
    const arm = (css: string) => { const d = document.createElement('div'); d.style.cssText = css; return d }
    crosshairEl.appendChild(arm('position:absolute;left:10px;top:0;width:3px;height:9px;background:#c0392b;box-shadow:0 0 0 1px white;'))
    crosshairEl.appendChild(arm('position:absolute;left:10px;bottom:0;width:3px;height:9px;background:#c0392b;box-shadow:0 0 0 1px white;'))
    crosshairEl.appendChild(arm('position:absolute;top:10px;left:0;height:3px;width:9px;background:#c0392b;box-shadow:0 0 0 1px white;'))
    crosshairEl.appendChild(arm('position:absolute;top:10px;right:0;height:3px;width:9px;background:#c0392b;box-shadow:0 0 0 1px white;'))
    const centerMarker = new maplibregl.Marker({ element: crosshairEl, draggable: false, anchor: 'center' })
      .setLngLat([initCenter.lng, initCenter.lat])
      .addTo(map)
    basemapCenterMarkerRef.current = centerMarker

    // ---- コーナーマーカー（縦横比固定ドラッグ） ----
    const markers = cornerKeys.map(key => {
      const el = document.createElement('div')
      el.style.cssText = 'width:14px;height:14px;background:#f59e0b;border:2.5px solid white;border-radius:50%;cursor:grab;box-shadow:0 2px 6px rgba(0,0,0,0.5);'

      const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
        .setLngLat([basemap.corners[key].lng, basemap.corners[key].lat])
        .addTo(map)

      marker.on('drag', () => {
        // 中心を固定してスケール
        const pivot = calcCenter(origCorners)
        const origVec = { dlat: origCorners[key].lat - pivot.lat, dlng: origCorners[key].lng - pivot.lng }
        const drag = marker.getLngLat()
        const newVec = { dlat: drag.lat - pivot.lat, dlng: drag.lng - pivot.lng }
        const dot = newVec.dlat * origVec.dlat + newVec.dlng * origVec.dlng
        const lenSq = origVec.dlat ** 2 + origVec.dlng ** 2
        const s = lenSq > 0 ? Math.max(0.1, dot / lenSq) : 1

        for (const k of cornerKeys) {
          liveCorners[k] = {
            lat: pivot.lat + s * (origCorners[k].lat - pivot.lat),
            lng: pivot.lng + s * (origCorners[k].lng - pivot.lng),
          }
        }
        marker.setLngLat([liveCorners[key].lng, liveCorners[key].lat])
        cornerKeys.forEach((k, i) => {
          if (k !== key) basemapMarkersRef.current[i]?.setLngLat([liveCorners[k].lng, liveCorners[k].lat])
        })
        const src = map.getSource('basemap') as maplibregl.ImageSource | undefined
        src?.setCoordinates(cornersToMapLibre(liveCorners))
        ;(map.getSource('basemap-hit') as maplibregl.GeoJSONSource | undefined)
          ?.setData(cornersToPolygon(liveCorners))
        map.setPaintProperty('basemap-layer', 'raster-opacity', 0.4)
      })

      marker.on('dragend', () => {
        Object.assign(origCorners, deepCopyCorners(liveCorners))
        map.setPaintProperty('basemap-layer', 'raster-opacity', 0.9)
        updateBasemapCornersRef.current({ ...liveCorners })
      })

      return marker
    })

    basemapMarkersRef.current = markers

    // ---- 全体移動（ベースマップ上をドラッグ）十字も連動 ----
    let panStart: { lat: number; lng: number; snap: MapImageCorners; snapPivot: { lat: number; lng: number } } | null = null
    let livePivot = basemapPivotRef.current ?? calcCenter(basemap.corners)

    const onBasemapDown = (e: maplibregl.MapLayerMouseEvent) => {
      // CP・候補がある場所ではCP操作を優先
      const cpHit = map.queryRenderedFeatures(e.point, { layers: ['cps-outer', 'cpc-outer'] })
      if (cpHit.length > 0) return
      e.preventDefault()
      panStart = {
        lat: e.lngLat.lat, lng: e.lngLat.lng,
        snap: deepCopyCorners(liveCorners),
        snapPivot: { ...livePivot },
      }
      map.dragPan.disable()
      map.getCanvas().style.cursor = 'grabbing'
      map.setPaintProperty('basemap-layer', 'raster-opacity', 0.4)
    }

    const onMousemove = (e: maplibregl.MapMouseEvent) => {
      if (!panStart) return
      const dlat = e.lngLat.lat - panStart.lat
      const dlng = e.lngLat.lng - panStart.lng
      for (const k of cornerKeys) {
        liveCorners[k] = { lat: panStart.snap[k].lat + dlat, lng: panStart.snap[k].lng + dlng }
      }
      livePivot = { lat: panStart.snapPivot.lat + dlat, lng: panStart.snapPivot.lng + dlng }
      const src = map.getSource('basemap') as maplibregl.ImageSource | undefined
      src?.setCoordinates(cornersToMapLibre(liveCorners))
      ;(map.getSource('basemap-hit') as maplibregl.GeoJSONSource | undefined)
        ?.setData(cornersToPolygon(liveCorners))
      markers.forEach((m, i) => m.setLngLat([liveCorners[cornerKeys[i]].lng, liveCorners[cornerKeys[i]].lat]))
      centerMarker.setLngLat([livePivot.lng, livePivot.lat])
    }

    const onMouseup = () => {
      if (!panStart) return
      panStart = null
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
      map.setPaintProperty('basemap-layer', 'raster-opacity', 0.9)
      Object.assign(origCorners, deepCopyCorners(liveCorners))
      updateBasemapCornersRef.current({ ...liveCorners })
      setBasemapPivotRef.current({ ...livePivot })
    }

    const onEnter = () => { if (!panStart) map.getCanvas().style.cursor = 'grab' }
    const onLeave = () => { if (!panStart) map.getCanvas().style.cursor = '' }

    map.on('mousedown', 'basemap-hit-layer', onBasemapDown)
    map.on('mousemove', onMousemove)
    map.on('mouseup', onMouseup)
    map.on('mouseenter', 'basemap-hit-layer', onEnter)
    map.on('mouseleave', 'basemap-hit-layer', onLeave)

    return () => {
      markers.forEach(m => m.remove())
      centerMarker.remove()
      basemapCenterMarkerRef.current = null
      map.off('mousedown', 'basemap-hit-layer', onBasemapDown)
      map.off('mousemove', onMousemove)
      map.off('mouseup', onMouseup)
      map.off('mouseenter', 'basemap-hit-layer', onEnter)
      map.off('mouseleave', 'basemap-hit-layer', onLeave)
    }
  }, [basemap]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- ピボット（十字）位置の更新 ----
  useEffect(() => {
    if (basemapPivot && basemapCenterMarkerRef.current) {
      basemapCenterMarkerRef.current.setLngLat([basemapPivot.lng, basemapPivot.lat])
    }
  }, [basemapPivot])

  // ---- competition map image overlay ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (map.getLayer('competition-map-layer')) map.removeLayer('competition-map-layer')
    if (map.getSource('competition-map')) map.removeSource('competition-map')

    const url = project.mapImageUrl
    const corners = project.metadata.map_image?.corners
    if (!url || !corners) return

    map.addSource('competition-map', {
      type: 'image',
      url,
      coordinates: cornersToMapLibre(corners),
    })
    map.addLayer({
      id: 'competition-map-layer',
      type: 'raster',
      source: 'competition-map',
      paint: { 'raster-opacity': 0.85 },
    }, 'print-bbox-fill')
  }, [project.mapImageUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- selection highlight ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    map.setFilter('cps-selected', selectedCpId
      ? ['==', ['get', 'id'], selectedCpId]
      : ['==', ['get', 'id'], ''])
  }, [selectedCpId])

  // ---- drag marker for selected CP ----
  useEffect(() => {
    if (cpDragMarkerRef.current) { cpDragMarkerRef.current.remove(); cpDragMarkerRef.current = null }
    const map = mapRef.current
    if (!map || !selectedCpId) return
    const cp = projectRef.current.cps.find(c => c.id === selectedCpId)
    if (!cp) return

    const el = document.createElement('div')
    el.style.cssText = 'width:12px;height:12px;background:white;border:1.5px solid black;border-radius:50%;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,0.4);'
    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
      .setLngLat(cp.coordinates).addTo(map)

    marker.on('drag', () => {
      const { lng, lat } = marker.getLngLat()
      const src = map.getSource('cps-src') as maplibregl.GeoJSONSource | undefined
      if (src) {
        const p = projectRef.current
        src.setData({ type: 'FeatureCollection', features: p.cps.map(c => ({
          type: 'Feature' as const,
          properties: { id: c.id, usage: c.usage, label: cpLabel(c.number, c.usage) },
          geometry: { type: 'Point' as const, coordinates: c.id === cp.id ? [lng, lat] : c.coordinates },
        })) } as Parameters<maplibregl.GeoJSONSource['setData']>[0])
      }
    })

    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat()
      const cur = projectRef.current.cps.find(c => c.id === selectedCpId)
      if (cur) updateCp({ ...cur, coordinates: [lng, lat] })
    })

    cpDragMarkerRef.current = marker
    return () => { if (cpDragMarkerRef.current) { cpDragMarkerRef.current.remove(); cpDragMarkerRef.current = null } }
  }, [selectedCpId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- click handlers ----
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const onCpClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      e.preventDefault()
      const f = e.features?.[0]
      if (!f) return
      const cpId = f.properties?.id as string

      if (cpLastClickId.current === cpId && cpClickTimer.current !== null) {
        clearTimeout(cpClickTimer.current)
        cpClickTimer.current = null
        cpLastClickId.current = null
        const cp = projectRef.current.cps.find(c => c.id === cpId)
        if (cp) onCpEditRef.current(cp)
      } else {
        cpLastClickId.current = cpId
        setSelectedCpId(cpId)
        if (cpClickTimer.current) clearTimeout(cpClickTimer.current)
        cpClickTimer.current = setTimeout(() => {
          cpClickTimer.current = null
          cpLastClickId.current = null
        }, 400)
      }
    }

    const onCandidateClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      e.preventDefault()
      const f = e.features?.[0]
      if (!f) return
      const cpcId = f.properties?.id as string
      const candidate = projectRef.current.cpCandidates.find(c => c.id === cpcId)
      if (candidate) onCpCandidateClickRef.current(candidate)
    }

    const onEmptyClick = (e: maplibregl.MapMouseEvent) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: ['cpc-outer', 'cps-outer'] })
      if (hit.length > 0) return
      setSelectedCpId(null)
    }

    map.on('click', 'cps-outer', onCpClick)
    map.on('click', 'cpc-outer', onCandidateClick)
    map.on('click', onEmptyClick)
    map.on('mouseenter', 'cps-outer', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'cps-outer', () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'cpc-outer', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'cpc-outer', () => { map.getCanvas().style.cursor = '' })

    return () => {
      map.off('click', 'cps-outer', onCpClick)
      map.off('click', 'cpc-outer', onCandidateClick)
      map.off('click', onEmptyClick)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ---- helpers ----
function cornersToMapLibre(c: MapImageCorners): [[number,number],[number,number],[number,number],[number,number]] {
  return [
    [c.top_left.lng,     c.top_left.lat],
    [c.top_right.lng,    c.top_right.lat],
    [c.bottom_right.lng, c.bottom_right.lat],
    [c.bottom_left.lng,  c.bottom_left.lat],
  ]
}

function cornersToPolygon(c: MapImageCorners) {
  const ring = [
    [c.top_left.lng, c.top_left.lat],
    [c.top_right.lng, c.top_right.lat],
    [c.bottom_right.lng, c.bottom_right.lat],
    [c.bottom_left.lng, c.bottom_left.lat],
    [c.top_left.lng, c.top_left.lat],
  ]
  return { type: 'FeatureCollection' as const, features: [{
    type: 'Feature' as const, properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  }] }
}

function deepCopyCorners(c: MapImageCorners): MapImageCorners {
  return {
    top_left:     { ...c.top_left },
    top_right:    { ...c.top_right },
    bottom_right: { ...c.bottom_right },
    bottom_left:  { ...c.bottom_left },
  }
}

function calcCenter(c: MapImageCorners): { lat: number; lng: number } {
  return {
    lat: (c.top_left.lat + c.top_right.lat + c.bottom_right.lat + c.bottom_left.lat) / 4,
    lng: (c.top_left.lng + c.top_right.lng + c.bottom_right.lng + c.bottom_left.lng) / 4,
  }
}

// ---- layer init ----
function initLayers(map: maplibregl.Map) {
  map.addSource('print-bbox', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'print-bbox-fill', type: 'fill', source: 'print-bbox',
    paint: { 'fill-color': '#2d6a4f', 'fill-opacity': 0.04 } })
  map.addLayer({ id: 'print-bbox-line', type: 'line', source: 'print-bbox',
    paint: { 'line-color': '#2d6a4f', 'line-width': 2, 'line-dasharray': [4, 2] } })

  map.addSource('cp-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'cp-lines', type: 'line', source: 'cp-lines',
    paint: { 'line-color': '#c0392b', 'line-width': 1.5, 'line-dasharray': [5, 3], 'line-opacity': 0.6 } })

  map.addSource('survey-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'survey-areas', type: 'fill', source: 'survey-src',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'] } })
  map.addLayer({ id: 'survey-areas-outline', type: 'line', source: 'survey-src',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.8 } })
  map.addLayer({ id: 'survey-lines', type: 'line', source: 'survey-src',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': ['get', 'opacity'] } })
  map.addLayer({ id: 'survey-points', type: 'circle', source: 'survey-src',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': ['get', 'size'], 'circle-color': 'white',
      'circle-stroke-width': 1.5, 'circle-stroke-color': 'black' } })

  map.addSource('cpc-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'cpc-outer', type: 'circle', source: 'cpc-src',
    paint: { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#888', 'circle-stroke-width': 2 } })
  map.addLayer({ id: 'cpc-inner', type: 'circle', source: 'cpc-src',
    filter: ['any', ['==', ['get', 'usage'], 'goal'], ['==', ['get', 'usage'], 'both']],
    paint: { 'circle-radius': 7, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#888', 'circle-stroke-width': 1.5 } })
  map.addLayer({ id: 'cpc-dot', type: 'circle', source: 'cpc-src',
    filter: ['!', ['any', ['==', ['get', 'usage'], 'goal'], ['==', ['get', 'usage'], 'both']]],
    paint: { 'circle-radius': 2.5, 'circle-color': '#888' } })
  map.addLayer({ id: 'cpc-label', type: 'symbol', source: 'cpc-src',
    filter: ['==', ['get', 'usage'], 'cp'],
    layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [1.2, -1.2], 'text-allow-overlap': true },
    paint: { 'text-color': '#888', 'text-halo-color': 'white', 'text-halo-width': 1.5 } })

  map.addSource('cps-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'cps-outer', type: 'circle', source: 'cps-src',
    paint: { 'circle-radius': 13, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#c0392b', 'circle-stroke-width': 2.5 } })
  map.addLayer({ id: 'cps-inner', type: 'circle', source: 'cps-src',
    filter: ['any', ['==', ['get', 'usage'], 'goal'], ['==', ['get', 'usage'], 'both']],
    paint: { 'circle-radius': 8, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#c0392b', 'circle-stroke-width': 2 } })
  map.addLayer({ id: 'cps-dot', type: 'circle', source: 'cps-src',
    filter: ['!', ['any', ['==', ['get', 'usage'], 'goal'], ['==', ['get', 'usage'], 'both']]],
    paint: { 'circle-radius': 3, 'circle-color': '#c0392b' } })
  map.addLayer({ id: 'cps-selected', type: 'circle', source: 'cps-src',
    filter: ['==', ['get', 'id'], ''],
    paint: { 'circle-radius': 18, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#f59e0b' } })
  map.addLayer({ id: 'cps-label', type: 'symbol', source: 'cps-src',
    filter: ['==', ['get', 'usage'], 'cp'],
    layout: { 'text-field': ['get', 'label'], 'text-size': 13, 'text-offset': [1.3, -1.3],
      'text-allow-overlap': true, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] },
    paint: { 'text-color': '#c0392b', 'text-halo-color': 'white', 'text-halo-width': 2 } })
}

// ---- render ----
function renderProject(map: maplibregl.Map, project: ProjectData) {
  const bbox = project.metadata.print.bbox
  ;(map.getSource('print-bbox') as maplibregl.GeoJSONSource)?.setData({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {},
      geometry: { type: 'Polygon', coordinates: [[[bbox[0],bbox[1]],[bbox[2],bbox[1]],[bbox[2],bbox[3]],[bbox[0],bbox[3]],[bbox[0],bbox[1]]]] } }],
  } as Parameters<maplibregl.GeoJSONSource['setData']>[0])

  const sortedCps = sortByOrder(project.cps)
  const lineFeatures: object[] = []
  for (let i = 1; i < sortedCps.length; i++) {
    lineFeatures.push({ type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: [sortedCps[i-1].coordinates, sortedCps[i].coordinates] } })
  }
  ;(map.getSource('cp-lines') as maplibregl.GeoJSONSource)?.setData(
    { type: 'FeatureCollection', features: lineFeatures } as Parameters<maplibregl.GeoJSONSource['setData']>[0])

  ;(map.getSource('survey-src') as maplibregl.GeoJSONSource)?.setData({
    type: 'FeatureCollection', features: buildSurveyFeatures(project.surveyMemos),
  } as Parameters<maplibregl.GeoJSONSource['setData']>[0])

  ;(map.getSource('cpc-src') as maplibregl.GeoJSONSource)?.setData({
    type: 'FeatureCollection',
    features: project.cpCandidates.map(c => ({
      type: 'Feature' as const,
      properties: { id: c.id, usage: c.usage, label: cpLabel(c.number, c.usage) },
      geometry: { type: 'Point' as const, coordinates: c.coordinates },
    })),
  })

  ;(map.getSource('cps-src') as maplibregl.GeoJSONSource)?.setData({
    type: 'FeatureCollection',
    features: project.cps.map(c => ({
      type: 'Feature' as const,
      properties: { id: c.id, usage: c.usage, label: cpLabel(c.number, c.usage) },
      geometry: { type: 'Point' as const, coordinates: c.coordinates },
    })),
  })
}

function buildSurveyFeatures(memos: SurveyMemo[]): object[] {
  return memos.map(m => {
    const style = m.style as Partial<PointStyle & LineStyle & AreaStyle>
    const props = {
      id: m.id, category: m.category,
      color: style.color ?? '#f59e0b', opacity: style.opacity ?? 0.9,
      size: (style as Partial<PointStyle>).size ?? 8,
      width: (style as Partial<LineStyle>).width ?? 3,
    }
    if (m.object_type === 'point')
      return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: m.coordinates } }
    if (m.object_type === 'line')
      return { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: m.coordinates } }
    const coords = m.coordinates as [number, number][]
    return { type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] } }
  })
}
