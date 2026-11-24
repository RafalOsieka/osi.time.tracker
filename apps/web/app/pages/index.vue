<script setup lang="ts">
// Until the Dashboard ships, `/` leads to the Timer view. A page middleware (not a route `redirect`)
// runs after the auth guard, so a visitor still goes to login and back to `/`.
definePageMeta({ middleware: () => navigateTo('/timer') });
</script>

<template>
  <div />
</template>
