<script setup lang="ts">
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { extractMessageKey } from '~/utils/extractMessageKey';

definePageMeta({ layout: 'auth', public: true });

const { t } = useI18n();
const { login } = useAuth();
const route = useRoute();

const state = reactive({ email: '', password: '' });
const error = ref('');
const pending = ref(false);
const clientErrorKey = ref('');

async function onSubmit(event: FormSubmitEvent<typeof state>) {
  error.value = '';
  clientErrorKey.value = '';
  pending.value = true;
  try {
    await login({ email: event.data.email, password: event.data.password });
    const target = sanitizeRedirect(route.query.redirect);
    await navigateTo(target);
  } catch (err) {
    error.value = t(extractMessageKey(err, 'auth.loginFailed'));
  } finally {
    pending.value = false;
  }
}

function onError(event: FormErrorEvent) {
  const first = event.errors[0]?.message;
  clientErrorKey.value = typeof first === 'string' ? first : '';
}

const showError = computed(() => Boolean(error.value || clientErrorKey.value));
const errorText = computed(
  () => error.value || (clientErrorKey.value ? t(clientErrorKey.value) : ''),
);
</script>

<template>
  <UCard data-testid="login-card">
    <UForm
      :schema="loginSchema"
      :state="state"
      class="grid gap-3"
      data-testid="login-form"
      @submit="onSubmit"
      @error="onError"
    >
      <UFormField :label="t('auth.emailLabel')" name="email" :ui="{ error: 'sr-only' }">
        <UInput
          id="email"
          v-model="state.email"
          type="email"
          autocomplete="email"
          data-testid="email"
          :aria-invalid="showError || undefined"
          :aria-describedby="showError ? 'login-error' : undefined"
        />
      </UFormField>

      <UFormField :label="t('auth.passwordLabel')" name="password" :ui="{ error: 'sr-only' }">
        <UInput
          id="password"
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          data-testid="password"
          :aria-invalid="showError || undefined"
          :aria-describedby="showError ? 'login-error' : undefined"
        />
      </UFormField>

      <UButton
        type="submit"
        block
        data-testid="login-button"
        :label="t('auth.loginButton')"
        :loading="pending"
      />

      <p
        v-if="showError"
        id="login-error"
        role="alert"
        data-testid="login-error"
        class="text-error text-sm"
      >
        {{ errorText }}
      </p>
    </UForm>
  </UCard>
</template>
