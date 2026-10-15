<script setup>
/**
 * Shared background-task progress strip (rescan / extract / population /
 * report — Tasks 2-4). Polls GET /api/tasks/<id> via pollTask until the
 * task settles.
 *
 * Props:  taskId (string, required) — switching ids restarts polling.
 * Emits:  done(task)  when status === 'done'
 *         failed(err) when status === 'failed' or the poll itself errors
 *                     (err.task carries the final snapshot when available).
 *
 * Style: thin --accent bar (progress is chrome) + micro-label message;
 * terminal state is carried by the TEXT color (--success / --danger),
 * never a background wash.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { pollTask } from '../composables/useTask.js'

const props = defineProps({
  taskId: { type: String, required: true },
})
const emit = defineEmits(['done', 'failed'])

const status = ref('pending')
const progress = ref(0)
const message = ref('')

let active = null

function applySnapshot(task) {
  status.value = task.status || 'pending'
  if (typeof task.progress === 'number') progress.value = task.progress
  message.value = task.message || ''
}

function start(taskId) {
  if (active) active.cancel()
  status.value = 'pending'
  progress.value = 0
  message.value = ''

  const polling = pollTask(taskId, { onUpdate: applySnapshot })
  active = polling

  polling
    .then((task) => {
      if (active !== polling) return
      emit('done', task)
    })
    .catch((err) => {
      if (active !== polling || err?.cancelled) return
      status.value = 'failed'
      message.value = err?.task?.message || err?.message || 'task failed'
      emit('failed', err)
    })
}

watch(
  () => props.taskId,
  (id) => {
    if (id) start(id)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (active) active.cancel()
})

const pct = computed(() => Math.max(0, Math.min(100, Math.round(progress.value * 100))))
const displayMessage = computed(() => message.value || status.value)
</script>

<template>
  <div class="task-progress">
    <div class="bar" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
      <div class="bar-fill" :style="{ width: pct + '%' }"></div>
    </div>
    <div
      class="micro-label msg"
      :class="{ 'msg-done': status === 'done', 'msg-failed': status === 'failed' }"
    >
      {{ displayMessage }}
    </div>
  </div>
</template>

<style scoped>
.task-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar {
  height: 3px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 200ms ease-out;
}

/* Terminal state lives in the text color — never a wash. */
.msg-done {
  color: var(--success);
}

.msg-failed {
  color: var(--danger);
}
</style>
