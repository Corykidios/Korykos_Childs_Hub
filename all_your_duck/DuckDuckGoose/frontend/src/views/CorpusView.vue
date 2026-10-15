<script setup>
// Stage 1 — project create, doc upload, folder registration, rescan.
import { computed, inject, ref, watch } from 'vue'
import { api, errorMessage } from '../api.js'
import TaskProgress from '../components/TaskProgress.vue'
import { useProject } from '../composables/useProject.js'

const refreshCapabilities = inject('refreshCapabilities', async () => {})
const { projectId, createProject } = useProject()

const project = ref(null)
const loadError = ref('')

/* --- create panel --- */
const showCreate = ref(false)
const newName = ref('')
const newQuestion = ref('')
const createError = ref('')
const creating = ref(false)

/* --- upload --- */
const fileInput = ref(null)
const uploading = ref(false)
const uploadError = ref('')
const uploadNote = ref('')
const dragOver = ref(false)

/* --- folders + rescan --- */
const folderPath = ref('')
const folderError = ref('')
const addingFolder = ref(false)
const rescanTaskId = ref('')
const rescanError = ref('')

const docs = computed(() => {
  const map = project.value?.docs || {}
  return Object.values(map).sort((a, b) =>
    (b.ingested_at || '').localeCompare(a.ingested_at || ''),
  )
})

async function loadProject() {
  const id = projectId.value
  if (!id) {
    project.value = null
    return
  }
  try {
    const data = await api.get(`/api/projects/${id}`)
    if (projectId.value !== id) return // selection changed mid-flight
    project.value = data
    loadError.value = ''
  } catch (err) {
    project.value = null
    loadError.value = errorMessage(err)
  }
}

watch(
  projectId,
  () => {
    // a project switch invalidates per-project transient state
    rescanTaskId.value = ''
    rescanError.value = ''
    uploadNote.value = ''
    uploadError.value = ''
    folderError.value = ''
    loadProject()
  },
  { immediate: true },
)

async function submitCreate() {
  createError.value = ''
  const name = newName.value.trim()
  const question = newQuestion.value.trim()
  if (!name || !question) {
    createError.value = 'name and question are required'
    return
  }
  creating.value = true
  try {
    await createProject(name, question) // selects the new project via useProject
    newName.value = ''
    newQuestion.value = ''
    showCreate.value = false
  } catch (err) {
    createError.value = errorMessage(err)
  } finally {
    creating.value = false
  }
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || [])
  if (!files.length || !projectId.value) return
  uploading.value = true
  uploadError.value = ''
  uploadNote.value = ''
  try {
    const res = await api.upload(`/api/projects/${projectId.value}/docs`, files)
    uploadNote.value = `added ${res.added} document${res.added === 1 ? '' : 's'}`
    await loadProject()
    await refreshCapabilities()
  } catch (err) {
    uploadError.value = errorMessage(err)
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function onPick(event) {
  uploadFiles(event.target.files)
}

function onDrop(event) {
  dragOver.value = false
  uploadFiles(event.dataTransfer?.files)
}

async function addFolder() {
  folderError.value = ''
  const path = folderPath.value.trim()
  if (!path) {
    folderError.value = 'path is required'
    return
  }
  addingFolder.value = true
  try {
    await api.post(`/api/projects/${projectId.value}/folders`, { path })
    folderPath.value = ''
    await loadProject()
  } catch (err) {
    folderError.value = errorMessage(err) // 400: "folder does not exist: …"
  } finally {
    addingFolder.value = false
  }
}

async function startRescan() {
  rescanError.value = ''
  try {
    const res = await api.post(`/api/projects/${projectId.value}/rescan`)
    rescanTaskId.value = res.task_id
  } catch (err) {
    rescanError.value = errorMessage(err)
  }
}

async function onRescanDone() {
  await loadProject()
  await refreshCapabilities()
}

function onRescanFailed() {
  // TaskProgress already shows the failure message in --danger.
}

function formatSize(bytes) {
  if (typeof bytes !== 'number') return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <section class="view">
    <div class="micro-label">Stage 01 — Corpus</div>
    <hr class="rule" />

    <!-- ============ Project create ============ -->
    <div v-if="!projectId || showCreate" class="panel create-panel">
      <span class="micro-label">Create project</span>
      <label class="field">
        <span class="micro-label">Name</span>
        <input v-model="newName" placeholder="my-universe" />
      </label>
      <label class="field">
        <span class="micro-label">Anchor question</span>
        <span class="field-hint">the question this universe answers</span>
        <textarea
          v-model="newQuestion"
          rows="3"
          placeholder="e.g. How would this community react if…?"
        ></textarea>
      </label>
      <p v-if="createError" class="danger-text">{{ createError }}</p>
      <div class="form-actions">
        <button class="btn btn-primary" :disabled="creating" @click="submitCreate">
          {{ creating ? 'Creating…' : 'Create' }}
        </button>
        <button v-if="projectId" class="btn" :disabled="creating" @click="showCreate = false">
          Cancel
        </button>
      </div>
      <p v-if="!projectId" class="hint">
        Or select an existing project from the top bar.
      </p>
    </div>
    <div v-else class="create-toggle">
      <button class="btn" @click="showCreate = true">New project</button>
    </div>

    <template v-if="projectId">
      <hr class="rule" />
      <p v-if="loadError" class="danger-text">{{ loadError }}</p>

      <template v-if="project">
        <!-- ============ Documents ============ -->
        <div class="section-head">
          <span class="micro-label">Documents</span>
          <span class="doc-count">
            <span class="big-num">{{ docs.length }}</span>
            <span class="micro-label">in corpus</span>
          </span>
        </div>
        <p class="question-line">{{ project.name }} — {{ project.question }}</p>

        <div class="panel">
          <p v-if="!docs.length" class="hint">
            No documents yet — upload files below or register a folder and rescan.
          </p>
          <table v-else class="docs-table">
            <thead>
              <tr>
                <th class="micro-label">Title</th>
                <th class="micro-label">Source</th>
                <th class="micro-label">Status</th>
                <th class="micro-label">Size</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in docs" :key="doc.doc_id">
                <td>{{ doc.title }}</td>
                <td class="muted">{{ doc.source }}</td>
                <td :class="doc.status === 'indexed' ? 'success-text' : 'muted'">
                  {{ doc.status }}
                </td>
                <td class="muted">{{ formatSize(doc.size) }}</td>
              </tr>
            </tbody>
          </table>

          <div
            class="dropzone"
            :class="{ 'dropzone-over': dragOver }"
            @dragenter.prevent="dragOver = true"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent="onDrop"
          >
            <span v-if="uploading" class="micro-label">Uploading…</span>
            <template v-else>
              <span class="micro-label">Drop .md / .txt files here</span>
              <button class="btn" @click="fileInput?.click()">Browse files</button>
              <input
                ref="fileInput"
                type="file"
                multiple
                accept=".md,.txt,.markdown"
                class="hidden-input"
                @change="onPick"
              />
            </template>
          </div>
          <p v-if="uploadNote" class="success-text">{{ uploadNote }}</p>
          <p v-if="uploadError" class="danger-text">{{ uploadError }}</p>
        </div>

        <hr class="rule" />

        <!-- ============ Folders + rescan ============ -->
        <div class="micro-label">Registered folders</div>
        <div class="panel folders-panel">
          <p v-if="!project.folders?.length" class="hint">
            No folders registered. Register a path (e.g. an Obsidian vault branch) and rescan
            to ingest its .md / .txt files.
          </p>
          <ul v-else class="folder-list">
            <li v-for="folder in project.folders" :key="folder">{{ folder }}</li>
          </ul>

          <div class="folder-row">
            <input
              v-model="folderPath"
              class="folder-input"
              placeholder="C:\path\to\notes"
              @keyup.enter="addFolder"
            />
            <button class="btn" :disabled="addingFolder" @click="addFolder">
              {{ addingFolder ? 'Adding…' : 'Add folder' }}
            </button>
            <button
              class="btn btn-primary"
              :disabled="!project.folders?.length"
              @click="startRescan"
            >
              Rescan
            </button>
          </div>
          <p v-if="folderError" class="danger-text">{{ folderError }}</p>
          <p v-if="rescanError" class="danger-text">{{ rescanError }}</p>

          <TaskProgress
            v-if="rescanTaskId"
            :task-id="rescanTaskId"
            @done="onRescanDone"
            @failed="onRescanFailed"
          />
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

/* --- create panel --- */
.create-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
}

.create-toggle {
  display: flex;
  justify-content: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-hint {
  color: var(--text-dim);
  font-size: 11px;
}

.form-actions {
  display: flex;
  gap: 8px;
}

/* --- documents --- */
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
}

.doc-count {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
}

.doc-count .big-num {
  font-size: 20px;
}

.question-line {
  color: var(--text-muted);
  margin-bottom: 10px;
}

.docs-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 14px;
}

.docs-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px dashed rgba(53, 90, 102, 0.5);
}

.docs-table td {
  padding: 7px 10px;
}

.docs-table tbody tr {
  border-bottom: 1px dashed rgba(53, 90, 102, 0.25);
}

/* --- drag-drop zone --- */
.dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 22px;
  border: 1px dashed var(--border-mid);
  border-radius: var(--radius);
  transition: border-color 200ms ease-out, background-color 200ms ease-out;
}

.dropzone-over {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.hidden-input {
  display: none;
}

/* --- folders --- */
.folders-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.folder-list {
  list-style: none;
  color: var(--text-muted);
}

.folder-list li {
  padding: 2px 0;
}

.folder-row {
  display: flex;
  gap: 8px;
}

.folder-input {
  flex: 1;
}
</style>
