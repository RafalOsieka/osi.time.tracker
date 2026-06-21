<script setup lang="ts">
const { loggedIn, user } = useAuth();

const statusLabel = computed(() => authStatusLabel(loggedIn.value, user.value));
</script>

<template>
  <section style="display: grid; gap: 1rem">
    <h2>Welcome</h2>
    <p data-testid="auth-status">{{ statusLabel }}</p>
  </section>
</template>
