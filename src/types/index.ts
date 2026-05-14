export interface PrintInfo {
  scale: string
  size: string
  orientation: 'portrait' | 'landscape'
  bbox: [number, number, number, number]
}

export interface MapImageCorners {
  top_left: { lat: number; lng: number }
  top_right: { lat: number; lng: number }
  bottom_right: { lat: number; lng: number }
  bottom_left: { lat: number; lng: number }
}

export interface MapImageInfo {
  filename: string
  corners: MapImageCorners
}

export interface BasemapImage {
  url: string
  corners: MapImageCorners
}

export interface S1Metadata {
  version: string
  schema: string
  created_at: string
  area_name: string
  memo: string
  print: PrintInfo
  map_image?: MapImageInfo
}

export interface CpCandidate {
  id: string
  type: 'cp_candidate'
  number: number
  usage: 'start' | 'goal' | 'cp' | 'both'
  order: number
  score: number
  memo: string
  source?: 's1'
  coordinates: [number, number]
}

export interface Cp {
  id: string
  type: 'cp'
  number: number
  usage: 'start' | 'goal' | 'cp' | 'both'
  order: number
  score: number
  acquired_lat: number
  acquired_lng: number
  acquired_at: string
  description: string
  memo: string
  photos: string[]
  source_candidate_id?: string
  coordinates: [number, number]
}

export type SurveyMemoObjectType = 'point' | 'line' | 'area'
export type MemoCategory = string

export interface PointStyle { size: number; color: string; opacity: number }
export interface LineStyle  { width: number; color: string; opacity: number }
export interface AreaStyle  { color: string; opacity: number }
export type SurveyMemoStyle = PointStyle | LineStyle | AreaStyle

export interface SurveyMemo {
  id: string
  type: 'survey_memo'
  object_type: SurveyMemoObjectType
  category: MemoCategory
  memo: string
  photos: string[]
  coordinates: [number, number] | [number, number][]
  style: SurveyMemoStyle
}

export interface ProjectData {
  metadata: S1Metadata
  cpCandidates: CpCandidate[]
  cps: Cp[]
  surveyMemos: SurveyMemo[]
  photos: Record<string, string>
  mapImageUrl?: string
}
