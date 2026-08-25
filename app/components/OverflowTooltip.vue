<script setup lang="ts">
import { isTextOverflowing } from '~/utils/isTextOverflowing';

const props = defineProps<{
  text: string;
}>();

const root = useTemplateRef<HTMLElement>('root');
const overflowing = ref(false);

function measure() {
  const el = root.value;
  if (!el) {
    overflowing.value = false;
    return;
  }
  overflowing.value = isTextOverflowing({
    tagName: el.tagName,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    querySelector: (sel) => {
      const found = el.querySelector(sel);
      if (!(found instanceof HTMLElement)) return null;
      return {
        tagName: found.tagName,
        scrollWidth: found.scrollWidth,
        clientWidth: found.clientWidth,
      };
    },
  });
}

onMounted(() => {
  void nextTick(measure);
  if (!root.value || !('ResizeObserver' in globalThis)) return;
  const observer = new ResizeObserver(() => {
    measure();
  });
  observer.observe(root.value);
  const inner = root.value.querySelector('input, textarea');
  if (inner) observer.observe(inner);
  onBeforeUnmount(() => {
    observer.disconnect();
  });
});

watch(
  () => props.text,
  () => {
    void nextTick(measure);
  },
);
</script>

<template>
  <div ref="root" class="min-w-0 max-w-full" :data-overflow-tooltip="overflowing ? 'on' : 'off'">
    <UTooltip :text="text" :disabled="!overflowing" :content="{ side: 'top', align: 'start' }">
      <slot />
    </UTooltip>
  </div>
</template>
