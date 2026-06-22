<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true });

const { login } = useAuth();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);

async function onLogin() {
  error.value = '';
  pending.value = true;
  try {
    await login({ email: email.value, password: password.value });
    email.value = '';
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
    <label for="email">Email</label>
    <InputText
      id="email"
      v-model="email"
      data-testid="email"
      autocomplete="email"
      :aria-invalid="!!error"
      :aria-describedby="error ? 'login-error' : undefined"
    />
    <label for="password">Password</label>
    <Password
      v-model="password"
      input-id="password"
      data-testid="password"
      :feedback="false"
      toggle-mask
      :input-style="{ width: '100%' }"
      :aria-invalid="!!error"
      :aria-describedby="error ? 'login-error' : undefined"
    />
    <Button type="submit" data-testid="login-button" label="Log in" :loading="pending" />
    <small
      v-if="error"
      id="login-error"
      role="alert"
      data-testid="login-error"
      style="color: var(--p-red-500, #ef4444)"
    >
      {{ error }}
    </small>
  </form>
</template>
