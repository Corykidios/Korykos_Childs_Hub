<script setup>
// Stage 2 — ontology, extraction, entity table, population dials, agent browser.
import { computed, inject, reactive, ref, watch } from 'vue'
import { api, ApiError, errorMessage } from '../api.js'
import TaskProgress from '../components/TaskProgress.vue'
import { useProject } from '../composables/useProject.js'
import {
  assembleBuildBody,
  defaultProtagonists,
  DIAL_DEFAULTS,
  dialErrors,
} from '../universe.js'

const refreshCapabilities = inject('refreshCapabilities', async () => {})
const { projectId } = useProject()

/* 409s that mean "no builder profile bound" get a Settings link. */
function isBuilder409(err) {
  return err instanceof ApiError && err.status === 409 && /builder/i.test(errorMessage(err))
}

/* ============ 1 · Ontology ============ */
const TYPE_GROUPS = [
  { key: 'entity_types', label: 'Entity types' },
  { key: 'edge_types', label: 'Edge types' },
]

const ontology = ref(null) // {entity_types, edge_types, generated_at} | null
const ontologyError = ref('')
const ontologyNeedsBuilder = ref(false)
const generating = ref(false)
const savingOntology = ref(false)
const ontologySavedNote = ref('')
const newType = reactive({ entity_types: '', edge_types: '' })
const expandedType = ref('') // "<group key>:<index>"

const hasOntology = computed(() => (ontology.value?.entity_types?.length ?? 0) > 0)

async function loadOntology(id) {
  try {
    const data = await api.get(`/api/projects/${id}/ontology`)
    if (projectId.value !== id) return
    ontology.value = Array.isArray(data?.entity_types) ? data : null
  } catch (err) {
    if (projectId.value !== id) return
    ontology.value = null
    ontologyError.value = errorMessage(err)
  }
}

async function generateOntology() {
  ontologyError.value = ''
  ontologyNeedsBuilder.value = false
  ontologySavedNote.value = ''
  generating.value = true
  try {
    ontology.value = await api.post(`/api/projects/${projectId.value}/ontology`)
    expandedType.value = ''
  } catch (err) {
    ontologyNeedsBuilder.value = isBuilder409(err)
    ontologyError.value = errorMessage(err)
  } finally {
    generating.value = false
  }
}

function addType(key) {
  const name = newType[key].trim()
  if (!name || !ontology.value) return
  ontology.value[key].push({ name, description: '' })
  newType[key] = ''
  ontologySavedNote.value = ''
}

function removeType(key, index) {
  ontology.value[key].splice(index, 1)
  if (expandedType.value === `${key}:${index}`) expandedType.value = ''
  ontologySavedNote.value = ''
}

function toggleTypeExpand(key, index) {
  const id = `${key}:${index}`
  expandedType.value = expandedType.value === id ? '' : id
}

function expandedOf(key) {
  const [k, i] = expandedType.value.split(':')
  if (k !== key) return null
  return ontology.value?.[key]?.[Number(i)] ?? null
}

function chipWidth(name) {
  return `${Math.min(Math.max(String(name ?? '').length + 1, 4), 40)}ch`
}

async function saveOntology() {
  ontologyError.value = ''
  ontologyNeedsBuilder.value = false
  ontologySavedNote.value = ''
  savingOntology.value = true
  const clean = (list) =>
    (list ?? [])
      .map((t) => ({
        name: String(t.name ?? '').trim(),
        description: String(t.description ?? '').trim(),
      }))
      .filter((t) => t.name)
  try {
    ontology.value = await api.put(`/api/projects/${projectId.value}/ontology`, {
      entity_types: clean(ontology.value.entity_types),
      edge_types: clean(ontology.value.edge_types),
    })
    expandedType.value = ''
    ontologySavedNote.value = 'ontology saved'
  } catch (err) {
    ontologyError.value = errorMessage(err)
  } finally {
    savingOntology.value = false
  }
}

/* ============ 2 · Extraction + graph summary ============ */
const graph = ref(null)
const graphError = ref('')
const extractTaskId = ref('')
const extracting = ref(false)
const extractError = ref('')
const extractNeedsBuilder = ref(false)

const entities = computed(() => graph.value?.entities ?? [])

async function loadGraph(id) {
  try {
    const data = await api.get(`/api/projects/${id}/graph`)
    if (projectId.value !== id) return
    graph.value = data
    graphError.value = ''
  } catch (err) {
    if (projectId.value !== id) return
    graph.value = null
    // 404 = not built yet — an expected state, not an error
    if (!(err instanceof ApiError && err.status === 404)) {
      graphError.value = errorMessage(err)
    }
  }
}

async function startExtract() {
  extractError.value = ''
  extractNeedsBuilder.value = false
  try {
    const res = await api.post(`/api/projects/${projectId.value}/extract`)
    extractTaskId.value = res.task_id
    extracting.value = true
  } catch (err) {
    extractNeedsBuilder.value = isBuilder409(err)
    extractError.value = errorMessage(err)
  }
}

async function onExtractDone() {
  extracting.value = false
  await loadGraph(projectId.value)
  resetChecks() // a new graph invalidates any manual protagonist override
  await refreshCapabilities()
}

function onExtractFailed() {
  // TaskProgress already shows the failure message in --danger.
  extracting.value = false
}

/* ============ 3 · Entity table + protagonist checks ============ */
const expandedEntity = ref('') // entity uuid
const checked = ref(new Set())
const overridden = ref(false)

function toggleEntity(uuid) {
  expandedEntity.value = expandedEntity.value === uuid ? '' : uuid
}

function resetChecks() {
  checked.value = new Set(defaultProtagonists(entities.value, dials.k_protagonists))
  overridden.value = false
}

function toggleProtagonist(uuid) {
  const next = new Set(checked.value)
  if (next.has(uuid)) next.delete(uuid)
  else next.add(uuid)
  checked.value = next
  overridden.value = true
}

/* ============ 4 · Population dials ============ */
const dials = reactive({ ...DIAL_DEFAULTS })
const buildTaskId = ref('')
const building = ref(false)
const buildError = ref('')
const buildNeedsBuilder = ref(false)

const dialErrs = computed(() => dialErrors(dials))
const dialsValid = computed(() => Object.keys(dialErrs.value).length === 0)

function pct(value) {
  return `${Math.round(Number(value) * 100)}%`
}

/* Changing K re-defaults the checkboxes unless the operator has overridden. */
watch(
  () => dials.k_protagonists,
  () => {
    if (!overridden.value) resetChecks()
  },
)

async function buildPopulation() {
  buildError.value = ''
  buildNeedsBuilder.value = false
  if (!dialsValid.value) return
  try {
    const body = assembleBuildBody(dials, entities.value, checked.value)
    const res = await api.post(`/api/projects/${projectId.value}/population`, body)
    buildTaskId.value = res.task_id
    building.value = true
  } catch (err) {
    buildNeedsBuilder.value = isBuilder409(err)
    buildError.value = errorMessage(err)
  }
}

async function onBuildDone() {
  building.value = false
  await loadPopulation(projectId.value)
  await refreshCapabilities()
}

function onBuildFailed() {
  // TaskProgress already shows the failure message in --danger.
  building.value = false
}

/* ============ 5 · Agent browser ============ */
const TIER_FILTERS = ['all', 'protagonist', 'crowd_llm', 'crowd_policy']

const population = ref(null)
const populationError = ref('')
const tierFilter = ref('all')
const expandedAgent = ref('') // agent_uid
const policyState = ref({}) // uid -> {loading|error|policy, editing, draft, saveError, saving}

const agents = computed(() => population.value?.agents ?? [])
const filteredAgents = computed(() =>
  tierFilter.value === 'all'
    ? agents.value
    : agents.value.filter((a) => a.tier === tierFilter.value),
)

const kindCounts = computed(() => countBy(agents.value, 'kind'))
const tierCounts = computed(() => countBy(agents.value, 'tier'))
const personaFailCount = computed(() => population.value?.persona_failures?.length ?? 0)
const policyFailCount = computed(() => population.value?.policy_failures?.length ?? 0)

function countBy(list, key) {
  const out = {}
  for (const item of list) out[item[key]] = (out[item[key]] ?? 0) + 1
  return out
}

async function loadPopulation(id) {
  try {
    const data = await api.get(`/api/projects/${id}/population`)
    if (projectId.value !== id) return
    population.value = data
    populationError.value = ''
  } catch (err) {
    if (projectId.value !== id) return
    population.value = null
    if (!(err instanceof ApiError && err.status === 404)) {
      populationError.value = errorMessage(err)
    }
  }
}

function toggleAgent(agent) {
  const next = expandedAgent.value === agent.agent_uid ? '' : agent.agent_uid
  expandedAgent.value = next
  if (next && agent.tier === 'crowd_policy') loadPolicy(agent.agent_uid)
}

async function loadPolicy(uid) {
  const existing = policyState.value[uid]
  if (existing?.policy || existing?.loading) return
  policyState.value[uid] = { loading: true }
  try {
    const policy = await api.get(`/api/projects/${projectId.value}/agents/${uid}/policy`)
    policyState.value[uid] = {
      policy,
      editing: false,
      draft: '',
      saveError: '',
      saving: false,
    }
  } catch (err) {
    policyState.value[uid] = { error: errorMessage(err) }
  }
}

function startEditPolicy(uid) {
  const st = policyState.value[uid]
  st.draft = JSON.stringify(st.policy, null, 2)
  st.saveError = ''
  st.editing = true
}

async function savePolicy(uid) {
  const st = policyState.value[uid]
  st.saveError = ''
  let parsed
  try {
    parsed = JSON.parse(st.draft)
  } catch (err) {
    st.saveError = `invalid JSON: ${err.message}`
    return
  }
  st.saving = true
  try {
    await api.put(`/api/projects/${projectId.value}/agents/${uid}/policy`, parsed)
    // Re-read so defaults filled in by the pydantic model are shown.
    st.policy = await api.get(`/api/projects/${projectId.value}/agents/${uid}/policy`)
    st.editing = false
  } catch (err) {
    st.saveError = errorMessage(err) // 400 pydantic error lists handled by errorMessage
  } finally {
    st.saving = false
  }
}

/* ============ load-all + project switch ============ */
/* A previous build's protagonists map back to entity checkboxes so the
 * table reflects what was actually built; a mismatch with the current
 * top-K default is an operator override. */
function seedChecksFromPopulation() {
  const pop = population.value
  if (!pop?.agents?.length || !entities.value.length) return
  const protoSet = new Set(pop.protagonist_uids ?? [])
  const uuids = pop.agents
    .filter((a) => a.kind === 'entity' && protoSet.has(a.agent_uid) && a.source_entity_uuid)
    .map((a) => a.source_entity_uuid)
  if (!uuids.length) return
  const defaults = new Set(defaultProtagonists(entities.value, dials.k_protagonists))
  const isDefault = uuids.length === defaults.size && uuids.every((u) => defaults.has(u))
  checked.value = new Set(uuids)
  overridden.value = !isDefault
}

async function loadAll() {
  const id = projectId.value
  if (!id) return
  await Promise.all([loadOntology(id), loadGraph(id), loadPopulation(id)])
  if (projectId.value !== id) return
  if (population.value?.dials) {
    for (const key of Object.keys(DIAL_DEFAULTS)) {
      if (key in population.value.dials) dials[key] = population.value.dials[key]
    }
  }
  resetChecks()
  seedChecksFromPopulation()
}

watch(
  projectId,
  () => {
    // a project switch invalidates per-project state
    ontology.value = null
    graph.value = null
    population.value = null
    ontologyError.value = ''
    ontologyNeedsBuilder.value = false
    ontologySavedNote.value = ''
    graphError.value = ''
    extractTaskId.value = ''
    extracting.value = false
    extractError.value = ''
    extractNeedsBuilder.value = false
    buildTaskId.value = ''
    building.value = false
    buildError.value = ''
    buildNeedsBuilder.value = false
    populationError.value = ''
    expandedType.value = ''
    expandedEntity.value = ''
    expandedAgent.value = ''
    tierFilter.value = 'all'
    policyState.value = {}
    Object.assign(dials, DIAL_DEFAULTS)
    checked.value = new Set()
    overridden.value = false
    loadAll()
  },
  { immediate: true },
)
</script>

<template>
  <section class="view">
    <div class="micro-label">Stage 02 — Universe</div>
    <hr class="rule" />

    <p v-if="!projectId" class="hint">Select a project from the top bar first.</p>

    <template v-else>
      <!-- ============ 1 · Ontology ============ -->
      <div class="section-head">
        <span class="micro-label">Ontology</span>
        <button class="btn" :class="{ 'btn-primary': !hasOntology }" :disabled="generating" @click="generateOntology">
          {{ generating ? 'Generating…' : hasOntology ? 'Regenerate' : 'Generate' }}
        </button>
      </div>
      <p v-if="ontologyError" class="danger-text">
        {{ ontologyError }}
        <template v-if="ontologyNeedsBuilder">
          — <router-link to="/settings">bind a builder profile in Settings</router-link>
        </template>
      </p>

      <p v-if="!ontology" class="hint">
        No ontology yet — Generate proposes entity and edge types from the corpus sample
        and the anchor question.
      </p>
      <div v-else class="panel ontology-panel">
        <div v-for="group in TYPE_GROUPS" :key="group.key" class="chip-group">
          <span class="micro-label">{{ group.label }}</span>
          <div class="chips">
            <span
              v-for="(t, i) in ontology[group.key]"
              :key="group.key + i"
              class="chip"
              :title="t.description || ''"
            >
              <input
                v-model="t.name"
                class="chip-input"
                :style="{ width: chipWidth(t.name) }"
                @input="ontologySavedNote = ''"
              />
              <button
                class="chip-btn"
                :class="{ 'chip-btn-active': expandedType === `${group.key}:${i}` }"
                title="description"
                @click="toggleTypeExpand(group.key, i)"
              >
                i
              </button>
              <button class="chip-btn chip-remove" title="remove" @click="removeType(group.key, i)">
                ×
              </button>
            </span>
            <span class="chip chip-add">
              <input
                v-model="newType[group.key]"
                class="chip-input add-input"
                placeholder="add type…"
                @keyup.enter="addType(group.key)"
              />
              <button class="chip-btn" title="add" @click="addType(group.key)">+</button>
            </span>
          </div>
          <label v-if="expandedOf(group.key)" class="field desc-field">
            <span class="micro-label">{{ expandedOf(group.key).name }} — description</span>
            <input
              v-model="expandedOf(group.key).description"
              placeholder="(no description)"
              @input="ontologySavedNote = ''"
            />
          </label>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" :disabled="savingOntology" @click="saveOntology">
            {{ savingOntology ? 'Saving…' : 'Save ontology' }}
          </button>
          <span v-if="ontologySavedNote" class="success-text">{{ ontologySavedNote }}</span>
          <span v-if="ontology.generated_at" class="hint generated-at">
            generated {{ ontology.generated_at.slice(0, 19).replace('T', ' ') }}
          </span>
        </div>
      </div>

      <hr class="rule" />

      <!-- ============ 2 · Extraction ============ -->
      <div class="section-head">
        <span class="micro-label">Extraction</span>
        <button
          class="btn btn-primary"
          :disabled="!hasOntology || extracting"
          :title="hasOntology ? '' : 'generate an ontology first'"
          @click="startExtract"
        >
          {{ extracting ? 'Extracting…' : 'Extract' }}
        </button>
      </div>
      <p v-if="extractError" class="danger-text">
        {{ extractError }}
        <template v-if="extractNeedsBuilder">
          — <router-link to="/settings">bind a builder profile in Settings</router-link>
        </template>
      </p>
      <TaskProgress
        v-if="extractTaskId"
        :task-id="extractTaskId"
        @done="onExtractDone"
        @failed="onExtractFailed"
      />
      <p v-if="graphError" class="danger-text">{{ graphError }}</p>
      <p v-if="graph" class="graph-summary">
        {{ graph.entity_count }} entities · {{ graph.edge_count }} edges ·
        {{ graph.dropped_edges }} dropped ·
        <span :class="graph.extraction_failures?.failed > 0 ? 'warn-text' : 'muted'">
          {{ graph.extraction_failures?.failed ?? 0 }}/{{ graph.extraction_failures?.total ?? 0 }}
          batches failed
        </span>
      </p>
      <p v-else-if="!extractTaskId" class="hint">
        No graph yet — Extract mines entities and relationships from every indexed document.
      </p>

      <template v-if="graph">
        <hr class="rule" />

        <!-- ============ 3 · Entity table ============ -->
        <div class="micro-label">Entities — influence ranked</div>
        <div class="panel table-panel">
          <p v-if="!entities.length" class="hint">The graph has no entities.</p>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th class="micro-label check-col">Protagonist</th>
                <th class="micro-label">Name</th>
                <th class="micro-label">Type</th>
                <th class="micro-label num-col">Mentions</th>
                <th class="micro-label num-col">Docs</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="e in entities" :key="e.uuid">
                <tr class="click-row" @click="toggleEntity(e.uuid)">
                  <td class="check-col" @click.stop>
                    <input
                      type="checkbox"
                      :checked="checked.has(e.uuid)"
                      @change="toggleProtagonist(e.uuid)"
                    />
                  </td>
                  <td>{{ e.canonical_name }}</td>
                  <td class="muted">{{ e.type }}</td>
                  <td class="num-col">{{ e.mention_count }}</td>
                  <td class="num-col muted">{{ e.doc_ids?.length ?? 0 }}</td>
                </tr>
                <tr v-if="expandedEntity === e.uuid" class="expand-row">
                  <td colspan="5">
                    <div class="expand-body">
                      <div class="micro-label">Aliases</div>
                      <p>{{ e.aliases?.length ? e.aliases.join(', ') : 'none' }}</p>
                      <div class="micro-label">Summary</div>
                      <p>{{ e.summary || '—' }}</p>
                      <div class="micro-label">Documents</div>
                      <p class="muted">{{ (e.doc_ids ?? []).join(' · ') || '—' }}</p>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          <p v-if="overridden" class="override-note">
            <span class="warn-text">protagonist override active</span>
            <button class="btn btn-small" @click="resetChecks">Reset to top-K</button>
          </p>
        </div>

        <hr class="rule" />

        <!-- ============ 4 · Population dials ============ -->
        <div class="micro-label">Population dials</div>
        <div class="panel dials-panel">
          <div class="dials-grid">
            <label class="field">
              <span class="micro-label">N — total agents</span>
              <input v-model.number="dials.n_total" type="number" min="1" step="1" />
              <span v-if="dialErrs.n_total" class="danger-text field-error">
                {{ dialErrs.n_total }}
              </span>
            </label>
            <label class="field">
              <span class="micro-label">K — protagonists</span>
              <input v-model.number="dials.k_protagonists" type="number" min="0" step="1" />
              <span v-if="dialErrs.k_protagonists" class="danger-text field-error">
                {{ dialErrs.k_protagonists }}
              </span>
            </label>
            <label class="field slider-field">
              <span class="micro-label">Retinue : public split</span>
              <input v-model.number="dials.retinue_ratio" type="range" min="0" max="1" step="0.05" />
              <span class="slider-label">
                retinue {{ pct(dials.retinue_ratio) }} · public {{ pct(1 - dials.retinue_ratio) }}
              </span>
              <span v-if="dialErrs.retinue_ratio" class="danger-text field-error">
                {{ dialErrs.retinue_ratio }}
              </span>
            </label>
            <label class="field check-field">
              <span class="check-row">
                <input v-model="dials.tiered" type="checkbox" />
                <span>Tiered: protagonists + crowd</span>
              </span>
              <span class="field-hint">protagonists get the full LLM brain; the crowd is split below</span>
            </label>
            <label v-if="dials.tiered" class="field slider-field">
              <span class="micro-label">Crowd LLM : policy split</span>
              <input v-model.number="dials.crowd_llm_ratio" type="range" min="0" max="1" step="0.05" />
              <span class="slider-label">
                llm {{ pct(dials.crowd_llm_ratio) }} · policy {{ pct(1 - dials.crowd_llm_ratio) }}
              </span>
              <span v-if="dialErrs.crowd_llm_ratio" class="danger-text field-error">
                {{ dialErrs.crowd_llm_ratio }}
              </span>
            </label>
          </div>

          <div class="form-actions">
            <button
              class="btn btn-primary"
              :disabled="!dialsValid || building"
              @click="buildPopulation"
            >
              {{ building ? 'Building…' : 'Build population' }}
            </button>
          </div>
          <p v-if="buildError" class="danger-text">
            {{ buildError }}
            <template v-if="buildNeedsBuilder">
              — <router-link to="/settings">bind a builder profile in Settings</router-link>
            </template>
          </p>
          <TaskProgress
            v-if="buildTaskId"
            :task-id="buildTaskId"
            @done="onBuildDone"
            @failed="onBuildFailed"
          />
        </div>
      </template>

      <template v-if="population">
        <hr class="rule" />

        <!-- ============ 5 · Agent browser ============ -->
        <div class="micro-label">Agents</div>
        <p class="agent-summary">
          <span class="big-num">{{ agents.length }}</span> agents
          <span class="muted">
            · kind: entity {{ kindCounts.entity ?? 0 }} / retinue {{ kindCounts.retinue ?? 0 }} /
            public {{ kindCounts.public ?? 0 }} · tier: protagonist
            {{ tierCounts.protagonist ?? 0 }} / crowd_llm {{ tierCounts.crowd_llm ?? 0 }} /
            crowd_policy {{ tierCounts.crowd_policy ?? 0 }}
          </span>
        </p>
        <p class="failure-line">
          <span :class="personaFailCount ? 'warn-text' : 'muted'">
            {{ personaFailCount }} persona failures
          </span>
          <span class="muted"> · </span>
          <span :class="policyFailCount ? 'warn-text' : 'muted'">
            {{ policyFailCount }} policy failures
          </span>
        </p>
        <p v-if="populationError" class="danger-text">{{ populationError }}</p>

        <div class="filter-row">
          <button
            v-for="f in TIER_FILTERS"
            :key="f"
            class="filter-chip micro-label"
            :class="{ 'filter-active': tierFilter === f }"
            @click="tierFilter = f"
          >
            {{ f }}
          </button>
        </div>

        <div class="panel table-panel">
          <p v-if="!filteredAgents.length" class="hint">No agents in this tier.</p>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th class="micro-label">Name</th>
                <th class="micro-label">Kind</th>
                <th class="micro-label">Tier</th>
                <th class="micro-label">Username</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="a in filteredAgents" :key="a.agent_uid">
                <tr class="click-row" @click="toggleAgent(a)">
                  <td>{{ a.name }}</td>
                  <td class="muted">{{ a.kind }}</td>
                  <td>
                    <span class="tier" :class="`tier-${a.tier}`">
                      <span class="status-dot"></span>
                      {{ a.tier }}
                    </span>
                  </td>
                  <td class="muted">{{ a.username }}</td>
                </tr>
                <tr v-if="expandedAgent === a.agent_uid" class="expand-row">
                  <td colspan="4">
                    <div class="expand-body">
                      <p v-if="a.persona_status === 'failed'" class="danger-text">
                        persona generation failed — retry the build or edit by hand
                      </p>
                      <div class="micro-label">Bio</div>
                      <p>{{ a.bio || '—' }}</p>
                      <div class="micro-label">Persona</div>
                      <p class="persona-text">{{ a.persona || '—' }}</p>

                      <template v-if="a.tier === 'crowd_policy'">
                        <div class="micro-label">Compiled policy</div>
                        <p v-if="policyState[a.agent_uid]?.loading" class="hint">
                          loading policy…
                        </p>
                        <p v-else-if="policyState[a.agent_uid]?.error" class="danger-text">
                          {{ policyState[a.agent_uid].error }}
                        </p>
                        <template v-else-if="policyState[a.agent_uid]?.policy">
                          <template v-if="!policyState[a.agent_uid].editing">
                            <pre class="code-block">{{
                              JSON.stringify(policyState[a.agent_uid].policy, null, 2)
                            }}</pre>
                            <div class="form-actions">
                              <button class="btn" @click="startEditPolicy(a.agent_uid)">
                                Edit
                              </button>
                            </div>
                          </template>
                          <template v-else>
                            <textarea
                              v-model="policyState[a.agent_uid].draft"
                              class="policy-editor"
                              rows="16"
                              spellcheck="false"
                            ></textarea>
                            <p
                              v-if="policyState[a.agent_uid].saveError"
                              class="danger-text"
                            >
                              {{ policyState[a.agent_uid].saveError }}
                            </p>
                            <div class="form-actions">
                              <button
                                class="btn btn-primary"
                                :disabled="policyState[a.agent_uid].saving"
                                @click="savePolicy(a.agent_uid)"
                              >
                                {{ policyState[a.agent_uid].saving ? 'Saving…' : 'Save' }}
                              </button>
                              <button
                                class="btn"
                                :disabled="policyState[a.agent_uid].saving"
                                @click="policyState[a.agent_uid].editing = false"
                              >
                                Cancel
                              </button>
                            </div>
                          </template>
                        </template>
                      </template>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.view {
  padding: 24px;
}

.hint {
  color: var(--text-muted);
}

.muted {
  color: var(--text-muted);
}

/* --- status text in data colors, never washes --- */
.success-text {
  color: var(--success);
}

.danger-text {
  color: var(--danger);
}

.warn-text {
  color: var(--warn);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-error {
  font-size: 11px;
}

.field-hint {
  color: var(--text-dim);
  font-size: 11px;
}

/* --- 1 · ontology chips --- */
.ontology-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chip-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  transition: border-color 200ms ease-out;
}

.chip:focus-within {
  border-color: var(--accent-dim);
}

.chip-input {
  background: transparent;
  border: none;
  padding: 2px 4px;
  font-size: 12px;
}

.chip-input:focus {
  outline: none;
}

.add-input {
  width: 12ch;
}

.chip-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  width: 18px;
  height: 18px;
  line-height: 1;
  cursor: pointer;
  border-radius: var(--radius);
  transition: color 200ms ease-out;
}

.chip-btn:hover {
  color: var(--text);
}

.chip-btn-active {
  color: var(--accent);
}

.chip-remove:hover {
  color: var(--danger);
}

.desc-field {
  max-width: 560px;
}

.generated-at {
  font-size: 11px;
}

/* --- 2 · graph summary --- */
.graph-summary {
  margin-top: 10px;
}

/* --- 3/5 · tables --- */
.table-panel {
  padding: 12px 16px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px dashed rgba(53, 90, 102, 0.5);
}

.data-table td {
  padding: 7px 10px;
  vertical-align: middle;
}

.data-table tbody tr:not(.expand-row) {
  border-bottom: 1px dashed rgba(53, 90, 102, 0.25);
}

.click-row {
  cursor: pointer;
}

.click-row:hover td {
  color: var(--text);
}

.check-col {
  width: 90px;
  text-align: center;
}

.num-col {
  text-align: right;
  width: 90px;
}

.expand-row td {
  padding: 4px 10px 12px;
}

.expand-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-left: 1px dashed rgba(53, 90, 102, 0.5);
}

.override-note {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.btn-small {
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
}

input[type='checkbox'] {
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
}

/* --- 4 · dials --- */
.dials-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dials-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 24px;
  max-width: 720px;
}

.slider-field input[type='range'] {
  padding: 0;
  border: none;
  background: transparent;
  accent-color: var(--accent);
}

.slider-label {
  color: var(--text-muted);
  font-size: 12px;
}

.check-field {
  justify-content: center;
}

.check-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* --- 5 · agent browser --- */
.agent-summary {
  margin-bottom: 2px;
}

.agent-summary .big-num {
  font-size: 20px;
}

.failure-line {
  margin-bottom: 10px;
}

.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.filter-chip {
  background: transparent;
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  padding: 4px 10px;
  cursor: pointer;
  transition: color 200ms ease-out, border-color 200ms ease-out;
}

.filter-chip:hover {
  color: var(--text);
  border-color: var(--text-muted);
}

.filter-active {
  color: var(--accent);
  border-color: var(--accent);
}

/* tier carried by colored dot + word, never a wash */
.tier {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.tier-protagonist {
  color: var(--accent);
}

.tier-crowd_llm {
  color: var(--info);
}

.tier-crowd_policy {
  color: var(--text-muted);
}

.persona-text {
  white-space: pre-wrap;
}

.code-block {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 360px;
  margin: 4px 0;
}

.policy-editor {
  width: 100%;
  font-size: 12px;
  line-height: 1.5;
  margin: 4px 0;
  resize: vertical;
}
</style>
