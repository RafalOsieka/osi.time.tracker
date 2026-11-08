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
    // Its own leading slot adds the rail's disclosure badge (see the template).
    slot: 'reports' as const,
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
    >
      <!--
        On the icon-only rail a small round badge with a chevron sits on the Reports icon's corner,
        like a toolbar button with a menu: it opens a menu, not a page. The icon stays centred.
      -->
      <template #reports-leading="{ active, ui }">
        <span class="relative inline-flex shrink-0">
          <UIcon
            name="i-lucide-chart-column"
            data-slot="linkLeadingIcon"
            :class="ui.linkLeadingIcon({ active })"
          />
          <span
            v-if="isCollapsed"
            class="absolute -end-1.5 -bottom-1.5 flex size-3 items-center justify-center rounded-full bg-(--app-surface-sidebar) text-default ring-1 ring-accented"
            aria-hidden="true"
            data-testid="nav-reports-disclosure"
          >
            <!-- A chevron drawn with 1.5px borders: the icon font's 1px stroke is too faint here;
                 a filled caret would read as "play". -->
            <span
              class="-ms-px size-[5px] -rotate-45 border-e-[1.5px] border-b-[1.5px] border-current"
            />
          </span>
        </span>
      </template>
    </UNavigationMenu>
  </nav>
</template>
