<script lang="ts" setup>
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import { computed, onMounted, ref } from 'vue';

import { OpenProjectPublisher, RedminePublisher } from '../api/publishers';
import { useEntriesStore } from '../stores/entries';
import { useItemsStore } from '../stores/items';
import { useProjectsStore } from '../stores/projects';
import { usePublishStore } from '../stores/publish';
import { getProjectToken } from '../utils/tokens';

const publishStore = usePublishStore();
const entriesStore = useEntriesStore();
const projectsStore = useProjectsStore();
const itemsStore = useItemsStore();

const publishing = ref(false);
const publishStatus = ref<Record<string, { loading: boolean; success?: boolean; error?: string }>>({});
const activityId = ref('');

onMounted(async () => {
  await Promise.all([projectsStore.load(), itemsStore.load()]);
});

const itemsById = computed(() => {
  const m = new Map<string, { id: string; title: string; projectId: string; remoteId: string | null }>();
  for (const i of itemsStore.items) m.set(i.id, i);
  return m;
});

const groups = computed(() => publishStore.groupEntries(entriesStore.entries, projectsStore.projects, itemsById.value));

const hasOpenProjectGroup = computed(() => {
  const projectsById = new Map(projectsStore.projects.map(p => [p.id, p]));
  return groups.value.some(g => projectsById.get(g.projectId)?.remoteTarget === 2);
});

async function publishAll() {
  publishing.value = true;
  const projectsById = new Map(projectsStore.projects.map(p => [p.id, p]));

  for (const group of groups.value) {
    const key = `${group.itemId}_${group.spentOn}`;
    publishStatus.value[key] = { loading: true };

    const project = projectsById.get(group.projectId);
    if (!project || !project.isRemote || !project.remoteBaseUrl) {
      publishStatus.value[key] = { loading: false, success: false, error: 'Project remote not configured.' };
      continue;
    }
    const token = getProjectToken(project.id);
    if (!token) {
      publishStatus.value[key] = { loading: false, success: false, error: 'No token stored for project.' };
      continue;
    }

    const roundedMinutes = publishStore.roundToNearest15(group.rawSeconds);
    const comments = publishStore.joinComments(group.entries);

    let result;
    if (project.remoteTarget === 1) {
      result = await RedminePublisher.publish({
        baseUrl: project.remoteBaseUrl,
        token,
        issueId: group.remoteId,
        spentOn: group.spentOn,
        hours: roundedMinutes / 60,
        comments,
        activityId: activityId.value || undefined,
      });
    } else {
      result = await OpenProjectPublisher.publish({
        baseUrl: project.remoteBaseUrl,
        token,
        workPackageId: group.remoteId,
        spentOn: group.spentOn,
        hours: publishStore.formatIsoDuration(roundedMinutes),
        comments,
        activityId: activityId.value || undefined,
      });
    }

    if (result.success) {
      publishStatus.value[key] = { loading: false, success: true };
      // Mark local entries as published (best-effort UI hint; backend persistence
      // of "published" state requires a dedicated endpoint).
      for (const entry of group.entries) {
        const idx = entriesStore.entries.findIndex(e => e.id === entry.id);
        if (idx >= 0) {
          entriesStore.entries[idx].published = true;
          entriesStore.entries[idx].publishedAtUtc = new Date().toISOString();
          entriesStore.entries[idx].publishedTo = project.remoteTarget;
          entriesStore.entries[idx].publishedRemoteId = result.remoteId ?? null;
        }
      }
    } else {
      publishStatus.value[key] = { loading: false, success: false, error: result.error };
    }
  }

  publishing.value = false;
}
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h2 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Publish</h2>

    <!-- Per-target shared options (activity id is the only one not per-project) -->
    <div class="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">Activity ID (optional)</label>
        <InputText v-model="activityId" placeholder="e.g. 9" />
      </div>
      <div class="self-end text-xs text-slate-500">
        Remote configuration and tokens are managed per project on the
        <span class="font-medium">Settings</span>
        page.
      </div>
    </div>

    <div v-if="groups.length > 0" class="space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
        <h3 class="text-sm font-bold text-slate-400 uppercase">Preview (rounded to 15m)</h3>
        <Button :loading="publishing" icon="pi pi-cloud-upload" label="Publish All" size="small" @click="publishAll" />
      </div>

      <div class="max-h-96 overflow-y-auto pr-2">
        <div
          v-for="group in groups"
          :key="group.itemId + '_' + group.spentOn"
          class="mb-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="font-medium text-slate-900 dark:text-white">
                #{{ group.remoteId }} - {{ group.itemTitle }}
              </div>
              <div class="text-xs text-slate-500">{{ group.spentOn }} ({{ group.projectName }})</div>
            </div>
            <div class="text-right">
              <div class="text-primary font-mono font-bold">
                {{ (publishStore.roundToNearest15(group.rawSeconds) / 60).toFixed(2) }}h
              </div>
              <div class="text-[10px] text-slate-400">Raw: {{ (group.rawSeconds / 3600).toFixed(2) }}h</div>
            </div>
          </div>
          <div class="mt-2 line-clamp-1 text-xs text-slate-400 italic">
            {{ publishStore.joinComments(group.entries) }}
          </div>

          <div v-if="publishStatus[`${group.itemId}_${group.spentOn}`]" class="mt-2">
            <div v-if="publishStatus[`${group.itemId}_${group.spentOn}`].loading" class="text-xs text-blue-500">
              <i class="pi pi-spin pi-spinner mr-1"></i>
              Publishing...
            </div>
            <div v-else-if="publishStatus[`${group.itemId}_${group.spentOn}`].success" class="text-xs text-green-500">
              <i class="pi pi-check mr-1"></i>
              Published successfully
            </div>
            <div v-else class="text-xs text-red-500">
              <i class="pi pi-exclamation-triangle mr-1"></i>
              {{ publishStatus[`${group.itemId}_${group.spentOn}`].error }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="py-8 text-center text-slate-400">
      <i class="pi pi-info-circle mb-2 block text-2xl"></i>
      No publishable entries — entries must be in a remote-configured project and linked to a remote item.
    </div>

    <Message v-if="hasOpenProjectGroup" :closable="false" class="mt-4" severity="info">
      OpenProject might require CORS configuration to allow requests from this origin.
    </Message>
  </div>
</template>
