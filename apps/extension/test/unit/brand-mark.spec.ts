import { expect, it } from 'vite-plus/test';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import BrandMark from '../../src/ui/BrandMark.vue';

it('renders the brand mark as a labelled image in the primary color', async () => {
  const html = await renderToString(createSSRApp(BrandMark, { size: 40 }));
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="OSI Time Tracker"');
  expect(html).toMatch(/class="[^"]*\btext-primary\b/);
  expect(html).toContain('width="40"');
});
