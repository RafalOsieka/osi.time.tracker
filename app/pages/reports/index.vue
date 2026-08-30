<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div data-testid="reports-hub" class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('reports.hubTitle') }}</h1>
    <NuxtLink to="/reports/monthly" class="block max-w-md" data-testid="reports-card-monthly">
      <UCard>
        <template #header>
          <span class="font-medium">{{ t('reports.monthly.cardTitle') }}</span>
        </template>
        <p class="text-muted">{{ t('reports.monthly.cardDescription') }}</p>
      </UCard>
    </NuxtLink>
  </div>
</template>
