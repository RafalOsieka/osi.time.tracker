<script setup lang="ts">
import Button from 'primevue/button';
import Card from 'primevue/card';
import Column from 'primevue/column';
import ColorPicker from 'primevue/colorpicker';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';
import ToggleButton from 'primevue/togglebutton';
import { onMounted, ref } from 'vue';

import { useProjectsStore } from '../stores/projects';
import { useItemsStore } from '../stores/items';

const projectsStore = useProjectsStore();
const itemsStore = useItemsStore();

const newProjectName = ref('');
const newProjectColor = ref('3b82f6'); // default blue

onMounted(async () => {
  await Promise.all([projectsStore.load(), itemsStore.load()]);
});

async function createProject() {
  if (!newProjectName.value.trim()) return;
  try {
    await projectsStore.create(newProjectName.value.trim(), '#' + newProjectColor.value);
    newProjectName.value = '';
  } catch (err) {
    alert((err as Error).message);
  }
}

async function toggleProjectArchive(p: any) {
  try {
    await projectsStore.update(p.id, p.name, p.color, !p.isArchived);
  } catch (err) {
    alert((err as Error).message);
  }
}

async function toggleItemArchive(i: any) {
  try {
    await itemsStore.update(i.id, i.name, !i.isArchived);
  } catch (err) {
    alert((err as Error).message);
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card>
      <template #title>Projects</template>
      <template #content>
        <div class="mb-4 flex items-center gap-2">
          <InputText v-model="newProjectName" placeholder="New Project Name" class="flex-1" />
          <ColorPicker v-model="newProjectColor" />
          <Button label="Add Project" icon="pi pi-plus" @click="createProject" />
        </div>

        <DataTable :value="projectsStore.projects" size="small">
          <Column field="name" header="Name"></Column>
          <Column header="Color">
            <template #body="slotProps">
              <div
                class="h-4 w-4 rounded-full"
                :style="{ backgroundColor: slotProps.data.color || '#ccc' }"
              ></div>
            </template>
          </Column>
          <Column header="Status">
            <template #body="slotProps">
              <span
                :class="slotProps.data.isArchived ? 'text-red-500' : 'text-green-500'"
                class="text-xs font-bold uppercase"
              >
                {{ slotProps.data.isArchived ? 'Archived' : 'Active' }}
              </span>
            </template>
          </Column>
          <Column header="Actions">
            <template #body="slotProps">
              <Button
                :icon="slotProps.data.isArchived ? 'pi pi-refresh' : 'pi pi-archive'"
                :severity="slotProps.data.isArchived ? 'success' : 'warning'"
                text
                rounded
                @click="toggleProjectArchive(slotProps.data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card>
      <template #title>Items (Remote Issues)</template>
      <template #content>
        <DataTable :value="itemsStore.items" size="small">
          <Column field="name" header="Name"></Column>
          <Column field="remoteId" header="Remote ID"></Column>
          <Column header="Target">
            <template #body="slotProps">
              {{ slotProps.data.remoteTarget === 1 ? 'Redmine' : 'OpenProject' }}
            </template>
          </Column>
          <Column header="Status">
            <template #body="slotProps">
              <span
                :class="slotProps.data.isArchived ? 'text-red-500' : 'text-green-500'"
                class="text-xs font-bold uppercase"
              >
                {{ slotProps.data.isArchived ? 'Archived' : 'Active' }}
              </span>
            </template>
          </Column>
          <Column header="Actions">
            <template #body="slotProps">
              <Button
                :icon="slotProps.data.isArchived ? 'pi pi-refresh' : 'pi pi-archive'"
                :severity="slotProps.data.isArchived ? 'success' : 'warning'"
                text
                rounded
                @click="toggleItemArchive(slotProps.data)"
              />
            </template>
          </Column>
        </DataTable>
        <p class="mt-4 text-xs text-slate-500">
          Items are currently created during tracking or via API.
        </p>
      </template>
    </Card>
  </div>
</template>
