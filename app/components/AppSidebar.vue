<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();

const props = withDefaults(defineProps<{ iconOnly?: boolean }>(), { iconOnly: false });

const navItems = computed<MenuItem[]>(() => [
  { label: t('nav.timer'), route: '/', icon: 'pi pi-stopwatch', key: 'timer' },
  { label: t('nav.clients'), route: '/clients', icon: 'pi pi-users', key: 'clients' },
  { label: t('nav.projects'), route: '/projects', icon: 'pi pi-briefcase', key: 'projects' },
  { label: t('nav.reports'), route: '/reports', icon: 'pi pi-chart-bar', key: 'reports' },
  { label: t('nav.settings'), route: '/settings', icon: 'pi pi-cog', key: 'settings' },
]);

function isActive(to: string) {
  return route.path === to;
}
</script>

<template>
  <Menu
    :model="navItems"
    class="app-sidebar__menu"
    aria-label="Main navigation"
    data-testid="app-sidebar"
  >
    <template #item="{ item, props: itemProps }">
      <NuxtLink
        v-tooltip.right="props.iconOnly ? item.label : undefined"
        :to="item.route"
        v-bind="itemProps.action"
        :aria-current="isActive(item.route) ? 'page' : undefined"
        :data-testid="`nav-link-${item.key}`"
        :class="{ 'app-sidebar__link--active': isActive(item.route) }"
      >
        <i :class="item.icon" aria-hidden="true" />
        <span v-if="!props.iconOnly">{{ item.label }}</span>
      </NuxtLink>
    </template>
  </Menu>
</template>

<style>
.app-sidebar__menu {
  width: 100%;
  height: 100%;
  background: transparent;
}

.app-sidebar__menu.p-menu {
  min-width: 0;
  border-width: 0;
}

.app-sidebar__menu .p-menu-item-content a {
  height: 2.5rem;
}

.app-sidebar__menu .p-menu-item-content a span {
  white-space: nowrap;
}

.app-sidebar__link--active {
  background-color: var(--p-primary-50, #ecfeff);
  color: var(--p-primary-color);
  font-weight: 600;
}

.dark .app-sidebar__link--active {
  background-color: var(--p-primary-950, #083344);
}
</style>
