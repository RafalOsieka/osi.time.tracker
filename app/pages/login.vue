<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { extractMessageKey } from '~/utils/extractMessageKey';

definePageMeta({ layout: 'auth', public: true });

const { t } = useI18n();
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
  } catch (err) {
    error.value = t(extractMessageKey(err));
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <Card data-testid="login-card">
    <template #content>
      <form data-testid="login-form" class="login-form" @submit.prevent="onLogin">
        <label for="email">{{ t('auth.emailLabel') }}</label>
        <InputText
          id="email"
          v-model="email"
          data-testid="email"
          autocomplete="email"
          :aria-invalid="!!error"
          :aria-describedby="error ? 'login-error' : undefined"
        />
        <label for="password">{{ t('auth.passwordLabel') }}</label>
        <Password
          v-model="password"
          input-id="password"
          data-testid="password"
          :feedback="false"
          toggle-mask
          fluid
          :aria-invalid="!!error"
          :aria-describedby="error ? 'login-error' : undefined"
        />
        <Button
          type="submit"
          data-testid="login-button"
          :label="t('auth.loginButton')"
          :loading="pending"
        />
        <small
          v-if="error"
          id="login-error"
          role="alert"
          data-testid="login-error"
          class="login-error"
        >
          {{ error }}
        </small>
      </form>
    </template>
  </Card>
</template>

<style scoped>
.login-form {
  display: grid;
  gap: 0.75rem;
}

.login-error {
  color: var(--p-form-field-invalid-color);
}
</style>
