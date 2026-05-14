import { create } from 'zustand'
import type { ProjectData, Cp, BasemapImage, MapImageCorners } from '../types'

interface ProjectStore {
  project: ProjectData | null
  selectedCpId: string | null
  basemap: BasemapImage | null
  setProject: (p: ProjectData) => void
  clearProject: () => void
  setSelectedCpId: (id: string | null) => void
  addCp: (cp: Cp) => void
  updateCp: (cp: Cp) => void
  deleteCp: (id: string) => void
  updateCps: (cps: Cp[]) => void
  setBasemap: (b: BasemapImage | null) => void
  updateBasemapCorners: (corners: MapImageCorners) => void
}

export const useProjectStore = create<ProjectStore>(set => ({
  project: null,
  selectedCpId: null,
  basemap: null,
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
  setBasemap: b => set({ basemap: b }),
  updateBasemapCorners: corners => set(s =>
    s.basemap ? { basemap: { ...s.basemap, corners } } : s),
}))
