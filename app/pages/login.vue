<script setup lang="ts">
import { Form } from '@primevue/forms';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import type { FormSubmitEvent } from '@primevue/forms';
import { useI18n } from 'vue-i18n';
import { extractMessageKey } from '~/utils/extractMessageKey';

definePageMeta({ layout: 'auth', public: true });

const { t } = useI18n();
const { login } = useAuth();
const route = useRoute();

const resolver = zodResolver(loginSchema);
const initialValues = { email: '', password: '' };
const error = ref('');
const pending = ref(false);

async function onSubmit({ valid, values }: FormSubmitEvent) {
  if (!valid) return;

  error.value = '';
  pending.value = true;
  try {
    await login({ email: values.email, password: values.password });
    const target = sanitizeRedirect(route.query.redirect);
    await navigateTo(target);
  } catch (err) {
    error.value = t(extractMessageKey(err, 'auth.loginFailed'));
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <Card data-testid="login-card">
    <template #content>
      <Form
        v-slot="$form"
        :resolver="resolver"
        :initial-values="initialValues"
        data-testid="login-form"
        class="login-form"
        @submit="onSubmit"
      >
        <label for="email">{{ t('auth.emailLabel') }}</label>
        <InputText
          id="email"
          name="email"
          data-testid="email"
          autocomplete="email"
          :aria-invalid="!!($form.email?.invalid || error)"
          :aria-describedby="$form.email?.invalid || error ? 'login-error' : undefined"
        />
        <label for="password">{{ t('auth.passwordLabel') }}</label>
        <Password
          input-id="password"
          name="password"
          data-testid="password"
          :feedback="false"
          toggle-mask
          fluid
          :aria-invalid="!!($form.password?.invalid || error)"
          :aria-describedby="$form.password?.invalid || error ? 'login-error' : undefined"
        />
        <Button
          type="submit"
          data-testid="login-button"
          :label="t('auth.loginButton')"
          :loading="pending"
        />
        <Message
          v-if="$form.email?.invalid || $form.password?.invalid || error"
          id="login-error"
          severity="error"
          size="small"
          variant="simple"
          role="alert"
          data-testid="login-error"
          class="login-error"
        >
          {{ error || t($form.email?.error?.message ?? $form.password?.error?.message) }}
        </Message>
      </Form>
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
