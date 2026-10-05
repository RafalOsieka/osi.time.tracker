import '../assets/css/main.css';
import { createApp, h, type Component } from 'vue';
import ui from '@nuxt/ui/vue-plugin';
import ExtensionApp from './ExtensionApp.vue';

/** Mounts an extension page (popup, options) inside the shared Nuxt UI shell. */
export function mountPage(page: Component): void {
  createApp(() => h(ExtensionApp, null, { default: () => h(page) }))
    .use(ui)
    .mount('#app');
}
