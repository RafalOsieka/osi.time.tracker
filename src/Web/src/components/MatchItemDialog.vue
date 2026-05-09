<script lang="ts" setup>
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { computed, ref, watch } from 'vue';

import type { Item } from '../api/types';
import { useItemsStore } from '../stores/items';
import { useProjectsStore } from '../stores/projects';
import { getProjectToken } from '../utils/tokens';

const props = defineProps<{
  modelValue: boolean;
  item: Item | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'matched', item: Item): void;
}>();

const itemsStore = useItemsStore();
const projectsStore = useProjectsStore();

const remoteId = ref('');
const remoteTitle = ref('');
const fetching = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);

const project = computed(() =>
  props.item ? (projectsStore.projects.find(p => p.id === props.item!.projectId) ?? null) : null
);

const tokenPresent = computed(() => (project.value ? getProjectToken(project.value.id).length > 0 : false));

watch(
  () => props.modelValue,
  open => {
    if (open && props.item) {
      remoteId.value = props.item.remoteId ?? '';
      remoteTitle.value = props.item.title;
      error.value = null;
    }
  }
);

function close() {
  emit('update:modelValue', false);
}

async function fetchRemoteTitle() {
  if (!project.value || !project.value.isRemote || !project.value.remoteBaseUrl) {
    error.value = 'Project is not configured for a remote target.';
    return;
  }
  if (!remoteId.value.trim()) {
    error.value = 'Enter the remote issue ID first.';
    return;
  }
  const token = getProjectToken(project.value.id);
  if (!token) {
    error.value = 'No token stored for this project. Set one on the Settings page.';
    return;
  }

  fetching.value = true;
  error.value = null;
  try {
    const base = project.value.remoteBaseUrl.replace(/\/$/, '');
    if (project.value.remoteTarget === 1) {
      // Redmine
      const res = await fetch(`${base}/issues/${remoteId.value.trim()}.json`, {
        headers: { 'X-Redmine-API-Key': token },
      });
      if (!res.ok) throw new Error(`Redmine returned ${res.status}`);
      const data = (await res.json()) as { issue?: { subject?: string } };
      remoteTitle.value = data.issue?.subject ?? remoteTitle.value;
    } else {
      // OpenProject
      const res = await fetch(`${base}/api/v3/work_packages/${remoteId.value.trim()}`, {
        headers: { Authorization: 'Basic ' + btoa('apikey:' + token) },
      });
      if (!res.ok) throw new Error(`OpenProject returned ${res.status}`);
      const data = (await res.json()) as { subject?: string };
      remoteTitle.value = data.subject ?? remoteTitle.value;
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    fetching.value = false;
  }
}

async function submit() {
  if (!props.item) return;
  if (!remoteId.value.trim() || !remoteTitle.value.trim()) {
    error.value = 'Remote ID and title are required.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const updated = await itemsStore.match(props.item.id, {
      remoteId: remoteId.value.trim(),
      remoteTitle: remoteTitle.value.trim(),
    });
    emit('matched', updated);
    close();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog
    :style="{ width: '32rem' }"
    :visible="modelValue"
    header="Match with Remote Issue"
    modal
    @update:visible="v => emit('update:modelValue', v)"
  >
    <div v-if="item" class="flex flex-col gap-3">
      <div class="text-sm text-slate-500">
        Item:
        <span class="font-medium text-slate-900 dark:text-white">{{ item.title }}</span>
      </div>
      <div class="text-sm text-slate-500">
        Project:
        <span class="font-medium text-slate-900 dark:text-white">{{ project?.name ?? '—' }}</span>
        <span v-if="project?.isRemote" class="ml-1 text-xs text-slate-400">
          ({{ project.remoteTarget === 1 ? 'Redmine' : 'OpenProject' }})
        </span>
      </div>

      <div
        v-if="!project?.isRemote"
        class="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
      >
        This item belongs to a non-remote project. You can still attach an arbitrary remote ID, but title auto-fetch is
        disabled.
      </div>
      <div
        v-else-if="!tokenPresent"
        class="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
      >
        No API token stored for this project. Add it on the Settings page to enable title auto-fetch.
      </div>

      <label class="flex flex-col gap-1 text-sm">
        Remote ID
        <div class="flex gap-2">
          <InputText v-model="remoteId" class="flex-1" placeholder="e.g. 12345" />
          <Button
            :disabled="!project?.isRemote || !tokenPresent || !remoteId.trim()"
            :loading="fetching"
            icon="pi pi-download"
            label="Fetch title"
            severity="secondary"
            @click="fetchRemoteTitle"
          />
        </div>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        Title
        <InputText v-model="remoteTitle" placeholder="Issue title" />
      </label>

      <div v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="close" />
      <Button :loading="submitting" icon="pi pi-link" label="Match" @click="submit" />
    </template>
  </Dialog>
</template>
