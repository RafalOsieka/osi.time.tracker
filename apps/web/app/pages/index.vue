<script setup lang="ts">
import { Temporal } from 'temporal-polyfill';
import { isNavigationFailure, NavigationFailureType } from 'vue-router';
import {
  dashboardDateSchema,
  dashboardPeriodKindSchema,
  type DashboardDto,
  type DashboardGrouping,
  type DashboardPeriodDto,
  type DashboardPeriodKind,
  type DashboardQuery,
} from '~~/shared/types/dashboard';
import { extractCaughtMessageKey } from '~/utils/extract-message-key';
import { formatReportDuration } from '~/utils/format-report-duration';

const { t, locale } = useI18n();
usePageTitle(() => t('dashboard.pageTitle'));
const route = useRoute();
const router = useRouter();
const requestFetch = useRequestFetch();

/** The period as the URL has it, valid or not, so the server judges a malformed one. */
const query = computed(() => ({ period: route.query.period, date: route.query.date }));

// Lazy: on the client the await resolves at once and the page fills in; on the server it waits.
// One fixed key keeps the last answer while the next one loads, so the period control never
// empties between steps.
const { data, pending, error, refresh } = await useAsyncData(
  'dashboard',
  () => requestFetch<DashboardDto>('/api/dashboard', { query: query.value }),
  { watch: [query], lazy: true },
);

const loading = computed(() => pending.value || (!data.value && !error.value));
// The last error stays until the next answer, so a pending load hides it.
const errorKey = computed(() =>
  error.value && !loading.value
    ? extractCaughtMessageKey(error.value, 'dashboard.loadError')
    : null,
);
const emptyAccount = computed(() => !loading.value && data.value?.hasEntries === false);
const emptyPeriod = computed(
  () => !loading.value && !emptyAccount.value && data.value?.summary.daysWithEntries === 0,
);

const grouping = ref<DashboardGrouping>('project');

const figures = computed(() => {
  const summary = data.value?.summary;
  return [
    {
      id: 'total',
      icon: 'i-lucide-clock',
      label: t('dashboard.total'),
      value: formatReportDuration(summary?.totalSeconds ?? 0),
    },
    {
      id: 'days',
      icon: 'i-lucide-calendar-check',
      label: t('dashboard.daysWithEntries'),
      value: summary?.daysWithEntries ?? 0,
    },
    {
      id: 'average',
      icon: 'i-lucide-gauge',
      label: t('dashboard.average'),
      value: formatReportDuration(summary?.averageSeconds ?? 0),
    },
  ];
});

const kinds = computed(() =>
  dashboardPeriodKindSchema.options.map((value) => ({
    value,
    label: t(`dashboard.kind.${value}`),
  })),
);
/** The kind the URL asks for; none when it is invalid. */
const selectedKind = computed(() =>
  route.query.period === undefined
    ? 'month'
    : dashboardPeriodKindSchema.safeParse(route.query.period).data,
);

const DATE_FORMATS = {
  week: { dateStyle: 'medium' },
  month: { month: 'long', year: 'numeric' },
  year: { year: 'numeric' },
} satisfies Record<DashboardPeriodKind, Intl.DateTimeFormatOptions>;

/** Period days are calendar dates, so they format in UTC to stay on the same day. */
function formatPeriod({ kind, firstDay, lastDay }: DashboardPeriodDto): string {
  const format = new Intl.DateTimeFormat(locale.value, { ...DATE_FORMATS[kind], timeZone: 'UTC' });
  const first = new Date(`${firstDay}T00:00:00Z`);
  if (kind !== 'week') return format.format(first);
  // ICU versions disagree on the width of the spaces around the dash, which would make the server
  // and the browser render different text.
  return format
    .formatRange(first, new Date(`${lastDay}T00:00:00Z`))
    .replace(/\p{Space_Separator}/gu, ' ');
}

const periodLabel = computed(() => (data.value ? formatPeriod(data.value.period) : ''));

const nextUnavailable = computed(
  () => !!data.value && data.value.period.lastDay >= data.value.today,
);

/** Opening the period the URL already has loads it again, which retries a failed load. */
async function openPeriod(target: DashboardQuery): Promise<void> {
  const failure = await router.push({ path: '/', query: target });
  if (isNavigationFailure(failure, NavigationFailureType.duplicated)) await refresh();
}

function openTimer(): void {
  void router.push('/timer');
}

/** Opens the period that holds the day just outside the shown one. */
function step(direction: 'previous' | 'next'): void {
  // A second step before the first one has loaded would start from the period being left.
  if (!data.value || pending.value) return;
  const { kind, firstDay, lastDay } = data.value.period;
  const day =
    direction === 'previous'
      ? Temporal.PlainDate.from(firstDay).subtract({ days: 1 })
      : Temporal.PlainDate.from(lastDay).add({ days: 1 });
  void openPeriod({ period: kind, date: day.toString() });
}

/** From the current period to the one around today, otherwise around the asked day. */
function selectKind(kind: DashboardPeriodKind): void {
  if (kind === selectedKind.value && !error.value) return;
  const askedDay = dashboardDateSchema.safeParse(route.query.date).data;
  // While another period loads, the answer still held is not the one the URL asks for.
  const shown = pending.value ? null : data.value;
  const showsToday =
    !!shown && shown.period.firstDay <= shown.today && shown.today <= shown.period.lastDay;
  const date = showsToday ? shown.today : askedDay;
  void openPeriod(date ? { period: kind, date } : { period: kind });
}
</script>

<template>
  <div class="space-y-6" data-testid="dashboard-page">
    <PageHeader :title="t('dashboard.pageTitle')">
      <UFieldGroup role="group" :aria-label="t('dashboard.periodKind')">
        <UButton
          v-for="kind in kinds"
          :key="kind.value"
          :label="kind.label"
          color="neutral"
          variant="outline"
          :active="kind.value === selectedKind"
          active-color="primary"
          active-variant="subtle"
          active-class="font-semibold"
          :aria-pressed="kind.value === selectedKind"
          :data-testid="`dashboard-kind-${kind.value}`"
          @click="selectKind(kind.value)"
        />
      </UFieldGroup>
      <PeriodStepper
        :prev-label="t('dashboard.previousPeriod')"
        :next-label="t('dashboard.nextPeriod')"
        prev-testid="dashboard-prev"
        next-testid="dashboard-next"
        :disabled="!data"
        :next-disabled="nextUnavailable"
        @prev="step('previous')"
        @next="step('next')"
      >
        <PeriodLabel data-testid="dashboard-period-label">{{ periodLabel }}</PeriodLabel>
      </PeriodStepper>
    </PageHeader>

    <p v-if="errorKey" class="text-error" role="alert" data-testid="dashboard-error">
      {{ t(errorKey) }}
    </p>

    <EmptyState
      v-else-if="emptyAccount"
      icon="i-lucide-layout-dashboard"
      :title="t('dashboard.emptyAccountTitle')"
      :message="t('dashboard.emptyAccountMessage')"
      :cta-label="t('dashboard.emptyAccountCta')"
      cta-icon="i-lucide-timer"
      testid="dashboard-empty-account"
      @create="openTimer"
    />

    <template v-else>
      <div
        class="grid gap-4 sm:grid-cols-3"
        role="group"
        :aria-label="loading ? t('dashboard.loading') : t('dashboard.summary')"
        aria-live="polite"
        :aria-busy="loading"
        :data-testid="loading ? 'dashboard-loading' : 'dashboard-summary'"
      >
        <StatCard
          v-for="figure in figures"
          :key="figure.id"
          :label="figure.label"
          :icon="figure.icon"
        >
          <USkeleton v-if="loading" class="h-6 w-20" />
          <span v-else :data-testid="`dashboard-${figure.id}`">{{ figure.value }}</span>
        </StatCard>
        <p
          v-if="emptyPeriod"
          class="col-span-full mt-2 text-muted"
          data-testid="dashboard-empty-period"
        >
          {{ t('dashboard.emptyPeriod') }}
        </p>
      </div>

      <DashboardGroups
        v-if="!emptyPeriod"
        v-model:grouping="grouping"
        :dashboard="data ?? undefined"
        :loading="loading"
      />
    </template>
  </div>
</template>
