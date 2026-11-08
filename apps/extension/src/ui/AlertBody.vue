<script setup lang="ts">
import { computed } from 'vue';

/**
 * An alert message whose line breaks start short paragraphs, 4px apart, so a reassurance or a
 * second instruction reads as its own sentence instead of a wrapped continuation.
 */
const { text } = defineProps<{ text: string }>();

const paragraphs = computed(() => text.split('\n'));
</script>

<template>
  <span class="flex flex-col gap-1">
    <span v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</span>
  </span>
</template>
