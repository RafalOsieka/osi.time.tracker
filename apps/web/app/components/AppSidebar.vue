<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const { t } = useI18n();
const route = useRoute();

const { collapsed = false, iconOnly = false } = defineProps<{
  collapsed?: boolean;
  iconOnly?: boolean;
}>();

const isCollapsed = computed(() => collapsed || iconOnly);

/**
 * Remote sync (`/sync/*`) is the Timer's per-day companion and has no item of its own, so the
 * Timer item carries the selected wash there. Only the look: `aria-current` stays with the
 * current route's own link (REQ-071), which Remote sync does not have.
 */
const onRemoteSync = computed(() => route.path.startsWith('/sync/'));
const PARENT_ACTIVE_CLASS = 'text-primary before:bg-primary-100/80 dark:before:bg-primary/12';

/**
 * On the icon-only rail a small chevron inside the Reports tile, by its right edge, tells that it
 * opens a menu (to the right), not a page; the icon stays on the rail's centre axis. Drawn with two
 * borders of a rotated square, in the item's colour.
 */
const DISCLOSURE_CUE_CLASS =
  "after:absolute after:end-0 after:top-1/2 after:size-1.5 after:-translate-y-1/2 after:-rotate-45 after:border-e-[1.5px] after:border-b-[1.5px] after:border-current after:content-['']";

/** A small, even gap between items, so a selected tile never touches its neighbour. */
const NAV_UI = { list: 'flex flex-col gap-1', childList: 'flex flex-col gap-1' };

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.timer'),
    to: '/',
    icon: 'i-lucide-timer',
    active: route.path === '/',
    exact: true,
    class: onRemoteSync.value ? PARENT_ACTIVE_CLASS : undefined,
    ui: onRemoteSync.value ? { linkLeadingIcon: 'text-primary' } : undefined,
  },
  {
    label: t('nav.trackers'),
    to: '/trackers',
    icon: 'i-lucide-cable',
    active: route.path.startsWith('/trackers'),
  },
  {
    label: t('nav.projects'),
    to: '/projects',
    icon: 'i-lucide-briefcase',
    active: route.path.startsWith('/projects'),
  },
  {
    label: t('nav.reports'),
    icon: 'i-lucide-chart-column',
    type: 'trigger',
    open: true,
    defaultOpen: true,
    active: false,
    class: isCollapsed.value ? DISCLOSURE_CUE_CLASS : undefined,
    children: [
      {
        label: t('reports.monthly.pageTitle'),
        to: '/reports/monthly',
        icon: 'i-lucide-calendar-days',
        active: route.path.startsWith('/reports/monthly'),
      },
      {
        label: t('clientReport.pageTitle'),
        to: '/reports/client',
        icon: 'i-lucide-file-text',
        active: route.path.startsWith('/reports/client'),
      },
    ],
  },
]);
</script>

<template>
  <nav :aria-label="t('nav.main')" class="w-full">
    <UNavigationMenu
      :collapsed="isCollapsed"
      :tooltip="isCollapsed"
      :popover="isCollapsed"
      :items="navItems"
      orientation="vertical"
      class="w-full"
      :ui="NAV_UI"
    />
  </nav>
</template>
