<script setup lang="ts">
const { text } = defineProps<{
  text: string;
}>();

const root = useTemplateRef<HTMLElement>('root');
const overflowing = ref(false);

function measure() {
  const el = root.value;
  overflowing.value = el ? isTextOverflowing(el) : false;
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
  () => text,
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
