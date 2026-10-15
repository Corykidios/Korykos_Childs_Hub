<script setup>
import { onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from './api.js'
import { useProject } from './composables/useProject.js'
import { stageStates, STAGES } from './stepper.js'

const route = useRoute()
const router = useRouter()
const { projectId, projects, selectProject, loadProjects } = useProject()

const EMPTY_CAPS = { hasDocs: false, hasGraph: false, hasPopulation: false, runCount: 0 }
const capabilities = ref({ ...EMPTY_CAPS })
const states = ref(stageStates(null, EMPTY_CAPS))

/* 404-tolerant presence probe: graph/population GETs 404 until built. */
async function probe(path) {
  try {
    await api.get(path)
    return true
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return false
    return false // backend unreachable — treat as absent rather than crash the shell
  }
}

/*
 * The project GET does not carry graph/population presence, so the shell
 * assembles a capabilities object from cheap GETs and feeds the pure
 * stageStates() function. Re-assembled on project switch and on every
 * navigation (poll, not push).
 */
async function refreshCapabilities() {
  const id = projectId.value
  if (!id) {
    capabilities.value = { ...EMPTY_CAPS }
    states.value = stageStates(null, capabilities.value)
    return
  }
  const caps = { ...EMPTY_CAPS }
  try {
    const project = await api.get(`/api/projects/${id}`)
    caps.hasDocs = Object.keys(project.docs || {}).length > 0
  } catch {
    /* project vanished or backend down — defaults stand */
  }
  caps.hasGraph = await probe(`/api/projects/${id}/graph`)
  caps.hasPopulation = await probe(`/api/projects/${id}/population`)
  try {
    const data = await api.get(`/api/projects/${id}/runs`)
    caps.runCount = (data?.runs ?? []).length
  } catch {
    /* defaults stand */
  }
  if (projectId.value !== id) return // selection changed mid-flight
  capabilities.value = caps
  const project = projects.value.find((p) => p.id === id) ?? { id }
  states.value = stageStates(project, caps)
}

/* Later-task views call this after mutations (upload, build, launch). */
provide('refreshCapabilities', refreshCapabilities)

watch(projectId, refreshCapabilities)
router.afterEach(() => {
  refreshCapabilities()
})

onMounted(async () => {
  try {
    await loadProjects()
  } catch {
    /* backend not running yet — shell still renders */
  }
  await refreshCapabilities()
})

function onSelectProject(event) {
  selectProject(event.target.value || null)
}

function stepClasses(stage) {
  return {
    'step-current': route.path === stage.path,
    'step-complete': states.value[stage.key] === 'complete',
  }
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <span class="wordmark">DuckDuckGoose</span>
      <div class="topbar-right">
        <label class="micro-label" for="project-select">Project</label>
        <select
          id="project-select"
          :value="projectId ?? ''"
          @change="onSelectProject"
        >
          <option value="">— none —</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <router-link
          to="/settings"
          class="gear"
          :class="{ 'gear-active': route.path === '/settings' }"
          aria-label="Settings"
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56h.08a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03z" />
          </svg>
        </router-link>
      </div>
    </header>

    <nav class="stepper" aria-label="Wizard stages">
      <template v-for="(stage, i) in STAGES" :key="stage.key">
        <span v-if="i > 0" class="stepper-gap" aria-hidden="true"></span>
        <router-link
          v-if="states[stage.key] !== 'locked'"
          :to="stage.path"
          class="step micro-label"
          :class="stepClasses(stage)"
        >
          <span class="status-dot" :class="`dot-${states[stage.key]}`"></span>
          <span>{{ stage.label }}</span>
        </router-link>
        <span v-else class="step micro-label step-locked">
          <span class="status-dot dot-locked"></span>
          <span>{{ stage.label }}</span>
        </span>
      </template>
    </nav>

    <main>
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px dashed rgba(53, 90, 102, 0.5);
}

.wordmark {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-right select {
  min-width: 180px;
  height: 32px;
}

.gear {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
  transition: color 200ms ease-out;
}

.gear:hover {
  color: var(--text);
}

.gear-active {
  color: var(--accent);
}

/* --- Stepper: a horizontal rule of micro-label steps --- */
.stepper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px dashed rgba(53, 90, 102, 0.5);
}

.stepper-gap {
  flex: 1;
  border-top: 1px dashed rgba(53, 90, 102, 0.5);
}

.step {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  transition: color 200ms ease-out;
}

.step:hover {
  color: var(--text);
}

.step-current {
  color: var(--accent);
}

.step-locked {
  color: var(--text-dim);
  cursor: not-allowed;
}

/* State on the dot: complete = success, otherwise it rides currentColor. */
.dot-complete {
  color: var(--success);
}

.dot-locked {
  box-shadow: none;
}
</style>
