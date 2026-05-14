import { create } from 'zustand'
import type { ProjectData, Cp, BasemapImage, MapImageCorners } from '../types'

export type LatLng = { lat: number; lng: number }

const cornersCenter = (c: MapImageCorners): LatLng => ({
  lat: (c.top_left.lat + c.top_right.lat + c.bottom_right.lat + c.bottom_left.lat) / 4,
  lng: (c.top_left.lng + c.top_right.lng + c.bottom_right.lng + c.bottom_left.lng) / 4,
})

interface ProjectStore {
  project: ProjectData | null
  selectedCpId: string | null
  basemap: BasemapImage | null
  basemapPivot: LatLng | null
  setProject: (p: ProjectData) => void
  clearProject: () => void
  setSelectedCpId: (id: string | null) => void
  addCp: (cp: Cp) => void
  updateCp: (cp: Cp) => void
  deleteCp: (id: string) => void
  updateCps: (cps: Cp[]) => void
  setBasemap: (b: BasemapImage | null) => void
  updateBasemapCorners: (corners: MapImageCorners) => void
  setBasemapPivot: (p: LatLng | null) => void
}

export const useProjectStore = create<ProjectStore>(set => ({
  project: null,
  selectedCpId: null,
  basemap: null,
  basemapPivot: null,
  setProject: p => set({ project: p }),
  clearProject: () => set({ project: null, selectedCpId: null }),
  setSelectedCpId: id => set({ selectedCpId: id }),
  addCp: cp => set(s => s.project ? { project: { ...s.project, cps: [...s.project.cps, cp] } } : s),
  updateCp: cp => set(s => s.project
    ? { project: { ...s.project, cps: s.project.cps.map(c => c.id === cp.id ? cp : c) } } : s),
  deleteCp: id => set(s => s.project
    ? { project: { ...s.project, cps: s.project.cps.filter(c => c.id !== id) },
        selectedCpId: s.selectedCpId === id ? null : s.selectedCpId } : s),
  updateCps: cps => set(s => s.project ? { project: { ...s.project, cps } } : s),
  setBasemap: b => set({ basemap: b, basemapPivot: b ? cornersCenter(b.corners) : null }),
  updateBasemapCorners: corners => set(s =>
    s.basemap ? { basemap: { ...s.basemap, corners } } : s),
  setBasemapPivot: p => set({ basemapPivot: p }),
}))
