<script setup lang="ts">
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { computed, ref } from 'vue';

import { OpenProjectPublisher, RedminePublisher } from '../api/publishers';
import { useEntriesStore } from '../stores/entries';
import { usePublishStore } from '../stores/publish';

const publishStore = usePublishStore();
const entriesStore = useEntriesStore();

const publishing = ref(false);
const publishStatus = ref<Record<string, { loading: boolean; success?: boolean; error?: string }>>({});

const groups = computed(() => publishStore.groupEntries(entriesStore.entries));

const targets = [
  { label: 'Redmine', value: 1 },
  { label: 'OpenProject', value: 2 },
];

async function publishAll() {
  if (!publishStore.config.baseUrl || !publishStore.config.token) {
    alert('Please configure Base URL and Token first.');
    return;
  }

  publishing.value = true;
  const toPublish = groups.value;

  for (const group of toPublish) {
    const key = `${group.remoteId}_${group.spentOn}`;
    publishStatus.value[key] = { loading: true };

    let result;
    const roundedMinutes = publishStore.roundToNearest15(group.rawSeconds);
    const comments = publishStore.joinComments(group.entries);

    if (publishStore.config.target === 1) {
      result = await RedminePublisher.publish({
        baseUrl: publishStore.config.baseUrl,
        token: publishStore.config.token,
        issueId: group.remoteId,
        spentOn: group.spentOn,
        hours: roundedMinutes / 60,
        comments,
        activityId: publishStore.config.activityId,
      });
    } else {
      result = await OpenProjectPublisher.publish({
        baseUrl: publishStore.config.baseUrl,
        token: publishStore.config.token,
        workPackageId: group.remoteId,
        spentOn: group.spentOn,
        hours: publishStore.formatIsoDuration(roundedMinutes),
        comments,
        activityId: publishStore.config.activityId,
      });
    }

    if (result.success) {
      publishStatus.value[key] = { loading: false, success: true };
      // Update local entries
      for (const entry of group.entries) {
        try {
          await entriesStore.update(entry.id, {
            title: entry.title,
            note: entry.note,
            startUtc: entry.startUtc,
            endUtc: entry.endUtc,
            // We need to mark it as published in the store/DB
            // The UpdateEntryRequest doesn't have 'published' field in types.ts yet,
            // but we can at least update the local store state for now if we want,
            // or better, we should have added 'published' to the update API.
          });
          // For now, let's just mark it in the local store object
          const idx = entriesStore.entries.findIndex((e) => e.id === entry.id);
          if (idx >= 0) {
            entriesStore.entries[idx].published = true;
            entriesStore.entries[idx].publishedAtUtc = new Date().toISOString();
            entriesStore.entries[idx].publishedTo = publishStore.config.target;
            entriesStore.entries[idx].publishedRemoteId = result.remoteId ?? null;
          }
        } catch (e) {
          console.error('Failed to update local entry status', e);
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

    <!-- Config Section -->
    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">Target</label>
        <Select
          v-model="publishStore.config.target"
          :options="targets"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">Base URL</label>
        <InputText v-model="publishStore.config.baseUrl" placeholder="https://redmine.example.com" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">Token / API Key</label>
        <InputText v-model="publishStore.config.token" type="password" placeholder="Your secret token" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">Activity ID (Optional)</label>
        <InputText v-model="publishStore.config.activityId" placeholder="e.g. 9" />
      </div>
      <div class="flex items-center gap-2 md:col-span-2">
        <Checkbox v-model="publishStore.config.remember" :binary="true" inputId="remember-token" />
        <label for="remember-token" class="text-sm text-slate-600 dark:text-slate-400">Remember token in this browser</label>
      </div>
    </div>

    <!-- Preview Section -->
    <div v-if="groups.length > 0" class="space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
        <h3 class="text-sm font-bold text-slate-400 uppercase">Preview (Rounded to 15m)</h3>
        <Button
          label="Publish All"
          icon="pi pi-cloud-upload"
          size="small"
          :loading="publishing"
          @click="publishAll"
        />
      </div>

      <div class="max-h-96 overflow-y-auto pr-2">
        <div v-for="group in groups" :key="group.remoteId + group.spentOn" class="mb-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
          <div class="flex items-start justify-between">
            <div>
              <div class="font-medium text-slate-900 dark:text-white">
                #{{ group.remoteId }} - {{ group.itemName }}
              </div>
              <div class="text-xs text-slate-500">
                {{ group.spentOn }} ({{ group.projectName }})
              </div>
            </div>
            <div class="text-right">
              <div class="font-mono font-bold text-primary">
                {{ (publishStore.roundToNearest15(group.rawSeconds) / 60).toFixed(2) }}h
              </div>
              <div class="text-[10px] text-slate-400">
                Raw: {{ (group.rawSeconds / 3600).toFixed(2) }}h
              </div>
            </div>
          </div>
          <div class="mt-2 text-xs text-slate-400 italic line-clamp-1">
            {{ publishStore.joinComments(group.entries) }}
          </div>

          <!-- Status Indicator -->
          <div v-if="publishStatus[`${group.remoteId}_${group.spentOn}`]" class="mt-2">
            <div v-if="publishStatus[`${group.remoteId}_${group.spentOn}`].loading" class="text-xs text-blue-500">
              <i class="pi pi-spin pi-spinner mr-1"></i> Publishing...
            </div>
            <div v-else-if="publishStatus[`${group.remoteId}_${group.spentOn}`].success" class="text-xs text-green-500">
              <i class="pi pi-check mr-1"></i> Published successfully
            </div>
            <div v-else class="text-xs text-red-500">
              <i class="pi pi-exclamation-triangle mr-1"></i> {{ publishStatus[`${group.remoteId}_${group.spentOn}`].error }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="py-8 text-center text-slate-400">
      <i class="pi pi-info-circle mb-2 block text-2xl"></i>
      No unpublished entries found in the current view.
    </div>

    <Message v-if="publishStore.config.target === 2" severity="info" class="mt-4" :closable="false">
      OpenProject might require CORS configuration to allow requests from this origin.
    </Message>
  </div>
</template>
