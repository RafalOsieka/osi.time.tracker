<script lang="ts" setup>
import Button from 'primevue/button';
import Card from 'primevue/card';
import Column from 'primevue/column';
import ColorPicker from 'primevue/colorpicker';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, onMounted, reactive, ref } from 'vue';

import type { Item, Project, RemoteTarget } from '../api/types';
import { useItemsStore } from '../stores/items';
import { useProjectsStore } from '../stores/projects';
import { clearProjectToken, getProjectToken, setProjectToken } from '../utils/tokens';
import MatchItemDialog from './MatchItemDialog.vue';

const projectsStore = useProjectsStore();
const itemsStore = useItemsStore();

const targetOptions: { label: string; value: RemoteTarget | null }[] = [
  { label: 'Local only', value: null },
  { label: 'Redmine', value: 1 },
  { label: 'OpenProject', value: 2 },
];

interface ProjectDraft {
  name: string;
  color: string; // hex w/o '#'
  isDefault: boolean;
  remoteTarget: RemoteTarget | null;
  remoteBaseUrl: string;
  token: string;
}

function newDraft(): ProjectDraft {
  return {
    name: '',
    color: '3b82f6',
    isDefault: false,
    remoteTarget: null,
    remoteBaseUrl: '',
    token: '',
  };
}

const newProject = reactive<ProjectDraft>(newDraft());
const editing = ref<Record<string, ProjectDraft>>({});
const editingId = ref<string | null>(null);

// Item match dialog state
const matchOpen = ref(false);
const matchTarget = ref<Item | null>(null);

onMounted(async () => {
  await Promise.all([projectsStore.load(), itemsStore.load()]);
});

const projects = computed(() => projectsStore.projects);

function colorHex(c: string | null): string {
  if (!c) return '#cccccc';
  return c.startsWith('#') ? c : '#' + c;
}

function stripHash(c: string): string {
  return c.startsWith('#') ? c.slice(1) : c;
}

async function createProject() {
  if (!newProject.name.trim()) return;
  try {
    const created = await projectsStore.create({
      name: newProject.name.trim(),
      color: '#' + newProject.color,
      isDefault: newProject.isDefault,
      remoteTarget: newProject.remoteTarget,
      remoteBaseUrl: newProject.remoteBaseUrl.trim() || null,
    });
    if (newProject.token.trim()) {
      setProjectToken(created.id, newProject.token.trim());
    }
    Object.assign(newProject, newDraft());
  } catch (err) {
    alert((err as Error).message);
  }
}

function startEdit(p: Project) {
  editingId.value = p.id;
  editing.value[p.id] = {
    name: p.name,
    color: stripHash(p.color ?? '#3b82f6'),
    isDefault: p.isDefault,
    remoteTarget: p.remoteTarget,
    remoteBaseUrl: p.remoteBaseUrl ?? '',
    token: getProjectToken(p.id),
  };
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(p: Project) {
  const draft = editing.value[p.id];
  if (!draft) return;
  try {
    await projectsStore.update(p.id, {
      name: draft.name.trim(),
      color: '#' + draft.color,
      isArchived: p.isArchived,
      isDefault: draft.isDefault,
      remoteTarget: draft.remoteTarget,
      remoteBaseUrl: draft.remoteBaseUrl.trim() || null,
    });
    if (draft.token.trim()) setProjectToken(p.id, draft.token.trim());
    else clearProjectToken(p.id);
    editingId.value = null;
  } catch (err) {
    alert((err as Error).message);
  }
}

async function toggleProjectArchive(p: Project) {
  try {
    await projectsStore.update(p.id, {
      name: p.name,
      color: p.color,
      isArchived: !p.isArchived,
      isDefault: p.isDefault,
      remoteTarget: p.remoteTarget,
      remoteBaseUrl: p.remoteBaseUrl,
    });
  } catch (err) {
    alert((err as Error).message);
  }
}

async function removeProject(p: Project) {
  if (p.isDefault) {
    alert('The default project cannot be removed.');
    return;
  }
  if (!confirm(`Remove project "${p.name}"? Items inside will be deleted.`)) return;
  try {
    await projectsStore.remove(p.id);
    clearProjectToken(p.id);
  } catch (err) {
    alert((err as Error).message);
  }
}

async function toggleItemArchive(i: Item) {
  try {
    await itemsStore.update(i.id, i.title, !i.isArchived);
  } catch (err) {
    alert((err as Error).message);
  }
}

async function renameItem(i: Item) {
  const next = prompt('Rename item', i.title);
  if (!next || next.trim() === i.title) return;
  try {
    await itemsStore.update(i.id, next.trim(), i.isArchived);
  } catch (err) {
    alert((err as Error).message);
  }
}

function openMatch(i: Item) {
  matchTarget.value = i;
  matchOpen.value = true;
}

async function removeItem(i: Item) {
  if (!confirm(`Delete item "${i.title}"? All its time entries will be removed.`)) return;
  try {
    await itemsStore.remove(i.id);
  } catch (err) {
    alert((err as Error).message);
  }
}

function projectName(projectId: string): string {
  return projects.value.find(p => p.id === projectId)?.name ?? '';
}

function targetLabel(t: RemoteTarget | null): string {
  return targetOptions.find(o => o.value === t)?.label ?? '—';
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Projects -->
    <Card>
      <template #title>Projects</template>
      <template #content>
        <!-- Create project form -->
        <div class="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div class="flex items-center gap-2">
            <InputText v-model="newProject.name" class="flex-1" placeholder="Project name" />
            <ColorPicker v-model="newProject.color" />
          </div>
          <div class="flex items-center gap-2">
            <Select
              v-model="newProject.remoteTarget"
              :options="targetOptions"
              class="w-44"
              option-label="label"
              option-value="value"
            />
            <InputText
              v-model="newProject.remoteBaseUrl"
              :disabled="newProject.remoteTarget === null"
              class="flex-1"
              placeholder="https://example.com"
            />
          </div>
          <div class="flex items-center gap-2 md:col-span-2">
            <InputText
              v-model="newProject.token"
              :disabled="newProject.remoteTarget === null"
              class="flex-1"
              placeholder="API token (stored locally only)"
              type="password"
            />
            <label class="flex items-center gap-2 text-sm">
              <input v-model="newProject.isDefault" type="checkbox" />
              Default
            </label>
            <Button icon="pi pi-plus" label="Add Project" @click="createProject" />
          </div>
        </div>

        <DataTable :value="projects" data-key="id" size="small">
          <Column header="">
            <template #body="{ data }">
              <div :style="{ backgroundColor: colorHex(data.color) }" class="h-4 w-4 rounded-full"></div>
            </template>
          </Column>
          <Column field="name" header="Name">
            <template #body="{ data }">
              <template v-if="editingId === data.id">
                <InputText v-model="editing[data.id].name" class="w-full" />
              </template>
              <template v-else>
                <span class="font-medium">{{ data.name }}</span>
                <span
                  v-if="data.isDefault"
                  class="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase dark:bg-amber-900/30 dark:text-amber-300"
                >
                  Default
                </span>
              </template>
            </template>
          </Column>
          <Column header="Remote">
            <template #body="{ data }">
              <template v-if="editingId === data.id">
                <div class="flex flex-col gap-1">
                  <Select
                    v-model="editing[data.id].remoteTarget"
                    :options="targetOptions"
                    option-label="label"
                    option-value="value"
                  />
                  <InputText
                    v-model="editing[data.id].remoteBaseUrl"
                    :disabled="editing[data.id].remoteTarget === null"
                    placeholder="Base URL"
                  />
                  <InputText
                    v-model="editing[data.id].token"
                    :disabled="editing[data.id].remoteTarget === null"
                    placeholder="API token"
                    type="password"
                  />
                  <label class="flex items-center gap-2 text-xs">
                    <input v-model="editing[data.id].isDefault" type="checkbox" />
                    Default project
                  </label>
                </div>
              </template>
              <template v-else>
                <div class="text-xs">
                  <div>{{ targetLabel(data.remoteTarget) }}</div>
                  <div v-if="data.remoteBaseUrl" class="text-slate-400">{{ data.remoteBaseUrl }}</div>
                  <div v-if="data.isRemote" class="text-slate-400">
                    Token:
                    <span :class="getProjectToken(data.id) ? 'text-green-600' : 'text-amber-600'">
                      {{ getProjectToken(data.id) ? 'set' : 'missing' }}
                    </span>
                  </div>
                </div>
              </template>
            </template>
          </Column>
          <Column header="Status">
            <template #body="{ data }">
              <span :class="data.isArchived ? 'text-red-500' : 'text-green-500'" class="text-xs font-bold uppercase">
                {{ data.isArchived ? 'Archived' : 'Active' }}
              </span>
            </template>
          </Column>
          <Column header="Actions">
            <template #body="{ data }">
              <div class="flex gap-1">
                <template v-if="editingId === data.id">
                  <Button icon="pi pi-check" rounded severity="success" size="small" text @click="saveEdit(data)" />
                  <Button icon="pi pi-times" rounded severity="secondary" size="small" text @click="cancelEdit" />
                </template>
                <template v-else>
                  <Button icon="pi pi-pencil" rounded size="small" text @click="startEdit(data)" />
                  <Button
                    :icon="data.isArchived ? 'pi pi-refresh' : 'pi pi-archive'"
                    :severity="data.isArchived ? 'success' : 'warning'"
                    rounded
                    size="small"
                    text
                    @click="toggleProjectArchive(data)"
                  />
                  <Button
                    :disabled="data.isDefault"
                    icon="pi pi-trash"
                    rounded
                    severity="danger"
                    size="small"
                    text
                    @click="removeProject(data)"
                  />
                </template>
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Items -->
    <Card>
      <template #title>Items</template>
      <template #content>
        <DataTable :value="itemsStore.items" data-key="id" size="small">
          <Column field="title" header="Title">
            <template #body="{ data }">
              <span class="font-medium">{{ data.title }}</span>
              <span v-if="data.remoteId" class="ml-2 text-xs text-slate-500">#{{ data.remoteId }}</span>
            </template>
          </Column>
          <Column header="Project">
            <template #body="{ data }">{{ projectName(data.projectId) }}</template>
          </Column>
          <Column header="Status">
            <template #body="{ data }">
              <span :class="data.isArchived ? 'text-red-500' : 'text-green-500'" class="text-xs font-bold uppercase">
                {{ data.isArchived ? 'Archived' : 'Active' }}
              </span>
            </template>
          </Column>
          <Column header="Actions">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button aria-label="Rename" icon="pi pi-pencil" rounded size="small" text @click="renameItem(data)" />
                <Button
                  aria-label="Match remote"
                  icon="pi pi-link"
                  rounded
                  size="small"
                  text
                  @click="openMatch(data)"
                />
                <Button
                  :icon="data.isArchived ? 'pi pi-refresh' : 'pi pi-archive'"
                  :severity="data.isArchived ? 'success' : 'warning'"
                  rounded
                  size="small"
                  text
                  @click="toggleItemArchive(data)"
                />
                <Button icon="pi pi-trash" rounded severity="danger" size="small" text @click="removeItem(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
        <p class="mt-4 text-xs text-slate-500">
          Items can be created implicitly by starting a timer without selecting one — they appear under the default
          project.
        </p>
      </template>
    </Card>

    <MatchItemDialog v-model="matchOpen" :item="matchTarget" />
  </div>
</template>
