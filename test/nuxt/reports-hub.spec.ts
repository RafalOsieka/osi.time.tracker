import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import ReportsHub from '../../app/pages/reports/index.vue';

describe('reports hub', () => {
  it('renders the hub and monthly card instead of a coming-soon placeholder', async () => {
    const wrapper = await mountSuspended(ReportsHub, {
      global: {
        stubs: {
          UCard: { template: '<div><slot name="header" /><slot /></div>' },
          NuxtLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });
    expect(wrapper.find('[data-testid="reports-hub"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="reports-card-monthly"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="placeholder-page-reports"]').exists()).toBe(false);
  });
});
