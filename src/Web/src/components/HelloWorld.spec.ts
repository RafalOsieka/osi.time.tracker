import { mount } from '@vue/test-utils'
import HelloWorld from './HelloWorld.vue'
import { expect, test } from 'vitest'

test('HelloWorld.vue', async () => {
  const wrapper = mount(HelloWorld)
  expect(wrapper.text()).toContain('Get started')
})
