<script setup lang="ts">
const { loggedIn, user, login, logout } = useAuth();

const username = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);

const statusLabel = computed(() => authStatusLabel(loggedIn.value, user.value));

async function onLogin() {
  error.value = '';
  pending.value = true;
  try {
    await login({ username: username.value, password: password.value });
    username.value = '';
    password.value = '';
  } catch {
    error.value = 'Login failed. Please check your credentials.';
  } finally {
    pending.value = false;
  }
}

async function onLogout() {
  pending.value = true;
  try {
    await logout();
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <div style="max-width: 24rem; margin: 4rem auto; display: grid; gap: 1rem">
    <NuxtRouteAnnouncer />

    <h1>OSI Time Tracker</h1>
    <p data-testid="auth-status">{{ statusLabel }}</p>

    <!-- Unauthenticated: login form -->
    <form
      v-if="!loggedIn"
      data-testid="login-form"
      style="display: grid; gap: 0.75rem"
      @submit.prevent="onLogin"
    >
      <InputText
        v-model="username"
        data-testid="username"
        placeholder="Username"
        autocomplete="username"
      />
      <Password
        v-model="password"
        data-testid="password"
        :feedback="false"
        toggle-mask
        placeholder="Password"
        input-style="width: 100%"
      />
      <Button type="submit" data-testid="login-button" label="Log in" :loading="pending" />
      <small v-if="error" data-testid="login-error" style="color: var(--p-red-500, #ef4444)">
        {{ error }}
      </small>
    </form>

    <!-- Authenticated: logout action -->
    <Button
      v-else
      data-testid="logout-button"
      label="Log out"
      severity="secondary"
      :loading="pending"
      @click="onLogout"
    />
  </div>
</template>
