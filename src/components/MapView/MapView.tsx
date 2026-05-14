import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useProjectStore } from '../../store/projectStore'
import type { ProjectData, Cp, CpCandidate, SurveyMemo, PointStyle, LineStyle, AreaStyle } from '../../types'
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

  const { selectedCpId, setSelectedCpId, updateCp, basemap } = useProjectStore()

  const projectRef = useRef(project)
  projectRef.current = project
  const selectedCpIdRef = useRef(selectedCpId)
  selectedCpIdRef.current = selectedCpId
  const onCpEditRef = useRef(onCpEdit)
  onCpEditRef.current = onCpEdit
  const onCpCandidateClickRef = useRef(onCpCandidateClick)
  onCpCandidateClickRef.current = onCpCandidateClick

  const cpClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cpLastClickId = useRef<string | null>(null)

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

  // ---- PDF basemap overlay ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (map.getLayer('basemap-layer')) map.removeLayer('basemap-layer')
    if (map.getSource('basemap')) map.removeSource('basemap')
    if (!basemap) return

    const { corners } = basemap
    map.addSource('basemap', {
      type: 'image',
      url: basemap.url,
      coordinates: [
        [corners.top_left.lng, corners.top_left.lat],
        [corners.top_right.lng, corners.top_right.lat],
        [corners.bottom_right.lng, corners.bottom_right.lat],
        [corners.bottom_left.lng, corners.bottom_left.lat],
      ],
    })
    map.addLayer({
      id: 'basemap-layer',
      type: 'raster',
      source: 'basemap',
      paint: { 'raster-opacity': 0.9 },
    }, 'print-bbox-fill')
  }, [basemap]) // eslint-disable-line react-hooks/exhaustive-deps

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
      coordinates: [
        [corners.top_left.lng, corners.top_left.lat],
        [corners.top_right.lng, corners.top_right.lat],
        [corners.bottom_right.lng, corners.bottom_right.lat],
        [corners.bottom_left.lng, corners.bottom_left.lat],
      ],
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
