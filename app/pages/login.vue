<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true });

const { login } = useAuth();
const route = useRoute();

const username = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);

async function onLogin() {
  error.value = '';
  pending.value = true;
  try {
    await login({ username: username.value, password: password.value });
    username.value = '';
    password.value = '';
    const target = sanitizeRedirect(route.query.redirect);
    await navigateTo(target);
  } catch {
    error.value = 'Login failed. Please check your credentials.';
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <form data-testid="login-form" style="display: grid; gap: 0.75rem" @submit.prevent="onLogin">
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
</template>
