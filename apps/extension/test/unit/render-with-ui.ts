import { createSSRApp, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ui from '@nuxt/ui/vue-plugin';
import ExtensionApp from '../../src/ui/ExtensionApp.vue';

/** Server-renders a component inside the same Nuxt UI shell the extension pages mount. */
export function renderWithUi<Props extends object>(component: Component<Props>, props: Props) {
  const app = createSSRApp(() => h(ExtensionApp, null, { default: () => h(component, props) }));
  return renderToString(app.use(ui));
}
