<script setup>
// LLM endpoint profiles + role bindings (GET/PUT /api/settings/*).
import { onMounted, reactive, ref } from 'vue'
import { api, errorMessage } from '../api.js'
import {
  emptyProfileForm,
  REASONING_LABELS,
  REASONING_MODES,
  ROLES,
  validateProfile,
} from '../profile-form.js'

const profiles = ref([])
const roles = ref({})
const loadError = ref('')

/* --- inline form panel (one panel shared by add + edit) --- */
const form = ref(null) // null = closed
const formIsNew = ref(true)
const formErrors = ref({})
const formApiError = ref('')
const revealKey = ref(false)
const saving = ref(false)

/* --- per-profile state --- */
const confirmDelete = ref('') // profile name awaiting the confirm step
const testResults = reactive({}) // name -> {pending} | {ok, reply} | {ok: false, error}
const roleErrors = reactive({}) // role -> message

async function load() {
  try {
    const data = await api.get('/api/settings/profiles')
    profiles.value = data?.profiles ?? []
    roles.value = data?.roles ?? {}
    loadError.value = ''
  } catch (err) {
    loadError.value = errorMessage(err)
  }
}

onMounted(load)

function openAdd() {
  form.value = emptyProfileForm()
  formIsNew.value = true
  formErrors.value = {}
  formApiError.value = ''
  revealKey.value = false
}

function openEdit(profile) {
  // Profiles saved before `reasoning` existed come back without it.
  form.value = { reasoning: 'auto', ...profile }
  formIsNew.value = false
  formErrors.value = {}
  formApiError.value = ''
  revealKey.value = false
}

function closeForm() {
  form.value = null
}

async function saveProfile() {
  formApiError.value = ''
  const errs = validateProfile(form.value)
  formErrors.value = errs
  if (Object.keys(errs).length) return
  saving.value = true
  try {
    await api.put('/api/settings/profiles', {
      name: form.value.name.trim(),
      base_url: form.value.base_url.trim(),
      api_key: form.value.api_key ?? '',
      model: form.value.model.trim(),
      max_concurrency: Number(form.value.max_concurrency),
      reasoning: form.value.reasoning || 'auto',
    })
    await load()
    closeForm()
  } catch (err) {
    formApiError.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

async function deleteProfile(name) {
  try {
    await api.del(`/api/settings/profiles/${encodeURIComponent(name)}`)
    confirmDelete.value = ''
    delete testResults[name]
    await load() // role bindings to the deleted profile are dropped server-side
  } catch (err) {
    loadError.value = errorMessage(err)
  }
}

async function testProfile(name) {
  testResults[name] = { pending: true }
  try {
    // 200 either way: {ok: true, reply} or {ok: false, error}
    testResults[name] = await api.post(
      `/api/settings/profiles/${encodeURIComponent(name)}/test`,
    )
  } catch (err) {
    testResults[name] = { ok: false, error: errorMessage(err) }
  }
}

async function bindRole(role, event) {
  const profile = event.target.value
  if (!profile) return
  delete roleErrors[role]
  try {
    await api.put('/api/settings/roles', { role, profile })
    roles.value = { ...roles.value, [role]: profile }
  } catch (err) {
    roleErrors[role] = errorMessage(err)
    event.target.value = roles.value[role] ?? '' // revert the select
  }
}
</script>

<template>
  <section class="view">
    <div class="micro-label">Settings — LLM Endpoints</div>
    <hr class="rule" />

    <p v-if="loadError" class="danger-text">{{ loadError }}</p>

    <!-- ============ Endpoint profiles ============ -->
    <div class="panel">
      <div class="panel-head">
        <span class="micro-label">Endpoint profiles</span>
        <button class="btn btn-primary" @click="openAdd">Add profile</button>
      </div>

      <div v-if="!profiles.length" class="empty-hint">
        <p>No profiles yet. Add one to bind roles. Known-good base URLs:</p>
        <p class="hint-row">Ollama <code>http://localhost:11434/v1</code></p>
        <p class="hint-row">Anthropic <code>https://api.anthropic.com/v1</code></p>
      </div>

      <table v-else class="profiles-table">
        <thead>
          <tr>
            <th class="micro-label">Name</th>
            <th class="micro-label">Base URL</th>
            <th class="micro-label">Model</th>
            <th class="micro-label">Max conc</th>
            <th class="micro-label">Reasoning</th>
            <th class="micro-label">API key</th>
            <th class="micro-label"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="p in profiles" :key="p.name">
            <tr>
              <td>{{ p.name }}</td>
              <td class="muted">{{ p.base_url }}</td>
              <td>{{ p.model }}</td>
              <td>{{ p.max_concurrency }}</td>
              <td class="muted">{{ p.reasoning || 'auto' }}</td>
              <td class="muted">{{ p.api_key ? '•••' : '—' }}</td>
              <td class="row-actions">
                <button
                  class="btn"
                  :disabled="testResults[p.name]?.pending"
                  @click="testProfile(p.name)"
                >
                  {{ testResults[p.name]?.pending ? 'Testing…' : 'Test' }}
                </button>
                <button class="btn" @click="openEdit(p)">Edit</button>
                <template v-if="confirmDelete === p.name">
                  <button class="btn btn-danger" @click="deleteProfile(p.name)">Confirm</button>
                  <button class="btn" @click="confirmDelete = ''">Cancel</button>
                </template>
                <button v-else class="btn btn-danger" @click="confirmDelete = p.name">
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="testResults[p.name] && !testResults[p.name].pending" class="test-row">
              <td colspan="7">
                <span v-if="testResults[p.name].ok" class="success-text">
                  ok — {{ testResults[p.name].reply }}
                </span>
                <span v-else class="danger-text">
                  error — {{ testResults[p.name].error }}
                </span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- ============ Add / edit form (one inline panel) ============ -->
    <div v-if="form" class="panel form-panel">
      <span class="micro-label">
        {{ formIsNew ? 'Add profile' : `Edit profile — ${form.name}` }}
      </span>

      <div class="form-grid">
        <label class="field">
          <span class="micro-label">Name</span>
          <input
            v-model="form.name"
            :disabled="!formIsNew"
            :title="formIsNew ? '' : 'name is the identity — delete and re-add to rename'"
            placeholder="local-ollama"
          />
          <span v-if="formErrors.name" class="danger-text field-error">{{ formErrors.name }}</span>
        </label>
        <label class="field">
          <span class="micro-label">Base URL</span>
          <input v-model="form.base_url" placeholder="http://localhost:11434/v1" />
          <span v-if="formErrors.base_url" class="danger-text field-error">
            {{ formErrors.base_url }}
          </span>
        </label>
        <label class="field">
          <span class="micro-label">Model</span>
          <input v-model="form.model" placeholder="qwen3:8b" />
          <span v-if="formErrors.model" class="danger-text field-error">
            {{ formErrors.model }}
          </span>
        </label>
        <label class="field">
          <span class="micro-label">API key</span>
          <span class="key-row">
            <input
              v-model="form.api_key"
              :type="revealKey ? 'text' : 'password'"
              placeholder="(blank for local endpoints)"
              autocomplete="off"
            />
            <button class="btn" type="button" @click="revealKey = !revealKey">
              {{ revealKey ? 'Hide' : 'Show' }}
            </button>
          </span>
        </label>
        <label class="field">
          <span class="micro-label">Max concurrency</span>
          <input v-model="form.max_concurrency" type="number" min="1" step="1" />
          <span v-if="formErrors.max_concurrency" class="danger-text field-error">
            {{ formErrors.max_concurrency }}
          </span>
        </label>
        <label class="field">
          <span class="micro-label">Reasoning</span>
          <select v-model="form.reasoning">
            <option v-for="m in REASONING_MODES" :key="m" :value="m">
              {{ REASONING_LABELS[m] }}
            </option>
          </select>
          <span v-if="formErrors.reasoning" class="danger-text field-error">
            {{ formErrors.reasoning }}
          </span>
        </label>
      </div>

      <p class="muted field-hint">
        Reasoning models are handled either way: their thinking is stripped out
        of answers, never posted. Not every server honours the request to
        disable it, so treat this as a hint rather than a guarantee.
      </p>

      <p v-if="formApiError" class="danger-text">{{ formApiError }}</p>

      <div class="form-actions">
        <button class="btn btn-primary" :disabled="saving" @click="saveProfile">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button class="btn" :disabled="saving" @click="closeForm">Cancel</button>
      </div>
    </div>

    <hr class="rule" />

    <!-- ============ Role bindings ============ -->
    <div class="micro-label">Role bindings</div>
    <div class="panel roles-panel">
      <div v-for="role in ROLES" :key="role" class="role-row">
        <span class="micro-label role-name">{{ role }}</span>
        <select :value="roles[role] ?? ''" @change="bindRole(role, $event)">
          <option value="" disabled>(unbound)</option>
          <option v-for="p in profiles" :key="p.name" :value="p.name">{{ p.name }}</option>
        </select>
        <span v-if="roleErrors[role]" class="danger-text">{{ roleErrors[role] }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.view {
  padding: 24px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

/* --- empty state --- */
.empty-hint {
  color: var(--text-muted);
}

.hint-row code {
  color: var(--info);
}

/* --- profiles table --- */
.profiles-table {
  width: 100%;
  border-collapse: collapse;
}

.profiles-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px dashed rgba(53, 90, 102, 0.5);
}

.profiles-table td {
  padding: 7px 10px;
  vertical-align: middle;
}

.profiles-table tbody tr:not(.test-row) {
  border-bottom: 1px dashed rgba(53, 90, 102, 0.25);
}

.muted {
  color: var(--text-muted);
}

.row-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.test-row td {
  padding-top: 0;
}

/* --- status text in data colors, never washes --- */
.success-text {
  color: var(--success);
}

.danger-text {
  color: var(--danger);
}

/* --- form panel --- */
.form-panel {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-error {
  font-size: 11px;
}

.key-row {
  display: flex;
  gap: 6px;
}

.key-row input {
  flex: 1;
}

.form-actions {
  display: flex;
  gap: 8px;
}

/* --- role bindings --- */
.roles-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.role-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-name {
  width: 160px;
}

.role-row select {
  min-width: 220px;
  height: 32px;
}
</style>
