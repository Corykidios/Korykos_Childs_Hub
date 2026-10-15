import { ref } from 'vue'
import { api } from '../api.js'

const STORAGE_KEY = 'ddg.selectedProjectId'

function readStoredId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/* Module-level singletons: every component shares the same selection. */
const projectId = ref(readStoredId())
const projects = ref([])

export function useProject() {
  function selectProject(id) {
    projectId.value = id || null
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable (private mode) — selection is session-only */
    }
  }

  async function loadProjects() {
    const data = await api.get('/api/projects')
    projects.value = data?.projects ?? []
    // Drop a stale persisted selection that no longer exists.
    if (projectId.value && !projects.value.some((p) => p.id === projectId.value)) {
      selectProject(null)
    }
    return projects.value
  }

  async function createProject(name, question) {
    const project = await api.post('/api/projects', { name, question })
    projects.value = [...projects.value, project]
    selectProject(project.id)
    return project
  }

  return { projectId, projects, selectProject, loadProjects, createProject }
}
