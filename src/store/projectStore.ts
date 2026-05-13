import { create } from 'zustand'
import type { ProjectData, Cp } from '../types'

interface ProjectStore {
  project: ProjectData | null
  selectedCpId: string | null
  setProject: (p: ProjectData) => void
  clearProject: () => void
  setSelectedCpId: (id: string | null) => void
  addCp: (cp: Cp) => void
  updateCp: (cp: Cp) => void
  deleteCp: (id: string) => void
  updateCps: (cps: Cp[]) => void
}

export const useProjectStore = create<ProjectStore>(set => ({
  project: null,
  selectedCpId: null,
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
}))
