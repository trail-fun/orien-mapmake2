import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ProjectData, SurveyMemo, PointStyle, LineStyle, AreaStyle } from '../../types'

interface Props {
  project: ProjectData
}

const GSI_TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'

export default function MapView({ project }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  // init map
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

    map.on('load', () => {
      initLayers(map)
      renderProject(map, project)
    })

    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // re-render when project changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    renderProject(map, project)
  }, [project])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ---- layer init ----

function initLayers(map: maplibregl.Map) {
  // print bbox
  map.addSource('print-bbox', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'print-bbox-fill', type: 'fill', source: 'print-bbox',
    paint: { 'fill-color': '#2d6a4f', 'fill-opacity': 0.04 } })
  map.addLayer({ id: 'print-bbox-line', type: 'line', source: 'print-bbox',
    paint: { 'line-color': '#2d6a4f', 'line-width': 2, 'line-dasharray': [4, 2] } })

  // CP lines
  map.addSource('cp-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'cp-lines', type: 'line', source: 'cp-lines',
    paint: { 'line-color': '#c0392b', 'line-width': 1.5, 'line-dasharray': [5, 3], 'line-opacity': 0.6 } })

  // Survey memos
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

  // CP candidates (grey)
  map.addSource('cpc-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'cpc-outer', type: 'circle', source: 'cpc-src',
    paint: { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#888', 'circle-stroke-width': 2 } })
  map.addLayer({ id: 'cpc-inner', type: 'circle', source: 'cpc-src',
    filter: ['any', ['==', ['get', 'usage'], 'goal'], ['==', ['get', 'usage'], 'both']],
    paint: { 'circle-radius': 7, 'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#888', 'circle-stroke-width': 1.5 } })
  map.addLayer({ id: 'cpc-dot', type: 'circle', source: 'cpc-src',
    filter: ['!', ['any', ['==', ['get', 'usage'], 'goal'], ['==', ['get', 'usage'], 'both']]],
    paint: { 'circle-radius': 2.5, 'circle-color': '#888' } })
  map.addLayer({ id: 'cpc-label', type: 'symbol', source: 'cpc-src',
    filter: ['==', ['get', 'usage'], 'cp'],
    layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [1.2, -1.2], 'text-allow-overlap': true },
    paint: { 'text-color': '#888', 'text-halo-color': 'white', 'text-halo-width': 1.5 } })

  // Placed CPs (red)
  map.addSource('cps-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'cps-outer', type: 'circle', source: 'cps-src',
    paint: { 'circle-radius': 13, 'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#c0392b', 'circle-stroke-width': 2.5 } })
  map.addLayer({ id: 'cps-inner', type: 'circle', source: 'cps-src',
    filter: ['any', ['==', ['get', 'usage'], 'goal'], ['==', ['get', 'usage'], 'both']],
    paint: { 'circle-radius': 8, 'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#c0392b', 'circle-stroke-width': 2 } })
  map.addLayer({ id: 'cps-dot', type: 'circle', source: 'cps-src',
    filter: ['!', ['any', ['==', ['get', 'usage'], 'goal'], ['==', ['get', 'usage'], 'both']]],
    paint: { 'circle-radius': 3, 'circle-color': '#c0392b' } })
  map.addLayer({ id: 'cps-label', type: 'symbol', source: 'cps-src',
    filter: ['==', ['get', 'usage'], 'cp'],
    layout: { 'text-field': ['get', 'label'], 'text-size': 13, 'text-offset': [1.3, -1.3],
      'text-allow-overlap': true, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] },
    paint: { 'text-color': '#c0392b', 'text-halo-color': 'white', 'text-halo-width': 2 } })
}

// ---- data rendering ----

function sortByOrder<T extends { usage: string; order: number; number: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pri = (u: string) => u === 'start' ? 0 : u === 'goal' ? 2 : 1
    const d = pri(a.usage) - pri(b.usage)
    if (d !== 0) return d
    if (a.order !== b.order) return a.order - b.order
    return a.number - b.number
  })
}

function cpLabel(number: number, usage: string): string {
  if (usage === 'start') return 'S'
  if (usage === 'goal' || usage === 'both') return 'F'
  return String(number)
}

function renderProject(map: maplibregl.Map, project: ProjectData) {
  const bbox = project.metadata.print.bbox

  // Print bbox
  ;(map.getSource('print-bbox') as maplibregl.GeoJSONSource)?.setData({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature', properties: {},
      geometry: { type: 'Polygon', coordinates: [[[bbox[0],bbox[1]],[bbox[2],bbox[1]],[bbox[2],bbox[3]],[bbox[0],bbox[3]],[bbox[0],bbox[1]]]] },
    }],
  } as Parameters<maplibregl.GeoJSONSource['setData']>[0])

  // CP lines
  const sortedCps = sortByOrder(project.cps)
  const lineFeatures: object[] = []
  for (let i = 1; i < sortedCps.length; i++) {
    lineFeatures.push({
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: [sortedCps[i-1].coordinates, sortedCps[i].coordinates] },
    })
  }
  ;(map.getSource('cp-lines') as maplibregl.GeoJSONSource)?.setData(
    { type: 'FeatureCollection', features: lineFeatures } as Parameters<maplibregl.GeoJSONSource['setData']>[0])

  // Survey memos
  ;(map.getSource('survey-src') as maplibregl.GeoJSONSource)?.setData({
    type: 'FeatureCollection',
    features: buildSurveyFeatures(project.surveyMemos),
  } as Parameters<maplibregl.GeoJSONSource['setData']>[0])

  // CP candidates
  ;(map.getSource('cpc-src') as maplibregl.GeoJSONSource)?.setData({
    type: 'FeatureCollection',
    features: project.cpCandidates.map(c => ({
      type: 'Feature' as const,
      properties: { id: c.id, usage: c.usage, label: cpLabel(c.number, c.usage) },
      geometry: { type: 'Point' as const, coordinates: c.coordinates },
    })),
  })

  // Placed CPs
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
      color: style.color ?? '#f59e0b',
      opacity: style.opacity ?? 0.9,
      size: (style as Partial<PointStyle>).size ?? 8,
      width: (style as Partial<LineStyle>).width ?? 3,
    }
    if (m.object_type === 'point') {
      return { type: 'Feature', properties: props,
        geometry: { type: 'Point', coordinates: m.coordinates } }
    } else if (m.object_type === 'line') {
      return { type: 'Feature', properties: props,
        geometry: { type: 'LineString', coordinates: m.coordinates } }
    } else {
      const coords = m.coordinates as [number, number][]
      return { type: 'Feature', properties: props,
        geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] } }
    }
  })
}
