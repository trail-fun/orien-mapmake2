import { create } from 'zustand'
import type { ProjectData } from '../types'

interface ProjectStore {
  project: ProjectData | null
  setProject: (p: ProjectData) => void
  clearProject: () => void
}

export const useProjectStore = create<ProjectStore>(set => ({
  project: null,
  setProject: (project) => set({ project }),
  clearProject: () => set({ project: null }),
}))
