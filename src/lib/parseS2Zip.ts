import JSZip from 'jszip'
import type {
  ProjectData, Cp, CpCandidate, S1Metadata, PrintInfo,
  SurveyMemo, SurveyMemoObjectType, SurveyMemoStyle,
} from '../types'

function defaultStyle(objectType: SurveyMemoObjectType): SurveyMemoStyle {
  if (objectType === 'point') return { size: 10, color: '#2563eb', opacity: 0.9 }
  if (objectType === 'line') return { width: 3, color: '#111111', opacity: 0.9 }
  return { color: '#f59e0b', opacity: 0.35 }
}

export async function parseS2Zip(file: File): Promise<ProjectData> {
  const zip = await JSZip.loadAsync(file)
  const geojsonFile = zip.file('survey.geojson')
  if (!geojsonFile) throw new Error('survey.geojson が見つかりません')

  const geojsonText = await geojsonFile.async('text')
  const geojson = JSON.parse(geojsonText) as {
    metadata: Record<string, unknown>
    features: Array<{
      type: string
      properties: Record<string, unknown>
      geometry: { type: string; coordinates: unknown }
    }>
  }

  const meta = geojson.metadata ?? {}
  const printRaw = meta.print as Record<string, unknown> | undefined
  const print: PrintInfo = {
    scale: (printRaw?.scale ?? '1:10000') as string,
    size: (printRaw?.size ?? 'A4') as string,
    orientation: ((printRaw?.orientation ?? 'portrait') as string) as 'portrait' | 'landscape',
    bbox: (printRaw?.bbox as [number, number, number, number]) ?? [135, 34, 136, 35],
  }
  const metadata: S1Metadata = {
    version: (meta.version as string) ?? '1.0',
    schema: (meta.schema as string) ?? 'orienteering-survey-v1',
    created_at: (meta.created_at as string) ?? new Date().toISOString(),
    area_name: (meta.area_name as string) ?? '',
    memo: (meta.memo as string) ?? '',
    print,
  }

  const cpCandidates: CpCandidate[] = []
  const cps: Cp[] = []
  const surveyMemos: SurveyMemo[] = []

  for (const f of geojson.features ?? []) {
    const p = f.properties
    switch (p.type as string) {
      case 'cp_candidate':
        cpCandidates.push({
          id: p.id as string, type: 'cp_candidate',
          number: p.number as number, usage: p.usage as CpCandidate['usage'],
          order: (p.order as number) ?? 0, score: (p.score as number) ?? 10,
          memo: (p.memo as string) ?? '', source: 's1',
          coordinates: f.geometry.coordinates as [number, number],
        })
        break
      case 'cp':
        cps.push({
          id: p.id as string, type: 'cp',
          number: p.number as number, usage: p.usage as CpCandidate['usage'],
          order: (p.order as number) ?? 0, score: (p.score as number) ?? 10,
          acquired_lat: p.acquired_lat as number, acquired_lng: p.acquired_lng as number,
          acquired_at: p.acquired_at as string,
          description: (p.description as string) ?? '', memo: (p.memo as string) ?? '',
          photos: (p.photos as string[]) ?? [],
          source_candidate_id: p.source_candidate_id as string | undefined,
          coordinates: f.geometry.coordinates as [number, number],
        })
        break
      case 'survey_memo': {
        const objType = p.object_type as SurveyMemoObjectType
        let coordinates: [number, number] | [number, number][]
        if (objType === 'point') {
          coordinates = f.geometry.coordinates as [number, number]
        } else if (objType === 'line') {
          coordinates = f.geometry.coordinates as [number, number][]
        } else {
          const ring = (f.geometry.coordinates as [number, number][][])[0]
          coordinates = ring.slice(0, -1) as [number, number][]
        }
        const rawStyle = p.style as Record<string, unknown> | undefined
        const style: SurveyMemoStyle = rawStyle
          ? rawStyle as unknown as SurveyMemoStyle
          : defaultStyle(objType)
        surveyMemos.push({
          id: p.id as string, type: 'survey_memo', object_type: objType,
          category: (p.category as string) ?? '',
          memo: (p.memo as string) ?? '', photos: (p.photos as string[]) ?? [],
          coordinates, style,
        })
        break
      }
    }
  }

  const photos: Record<string, string> = {}
  const photosFolder = zip.folder('photos')
  if (photosFolder) {
    const entries = photosFolder.filter((_rel, file) => !file.dir)
    for (const entry of entries) {
      const base64 = await entry.async('base64')
      const name = entry.name.split('/').pop()!
      const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
      photos[name] = `data:${mime};base64,${base64}`
    }
  }

  return { metadata, cpCandidates, cps, surveyMemos, photos }
}
