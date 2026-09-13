import type { ClientFixture } from './types.js';

/**
 * Helios Energy — a solar installer running OpenProject. The consultant builds
 * their customer-facing solar portal (web + mobile), the inverter gateway
 * firmware tooling, a grid analytics service, and picks up internal tickets.
 */
export const HELIOS: ClientFixture = {
  tracker: 'openproject',
  clientName: 'Helios Energy',
  activities: ['Development', 'Specification', 'Testing'],
  projects: [
    { identifier: 'solar-portal', name: 'Solar Portal', parent: null, internal: false, issues: [] },
    {
      identifier: 'customer-app',
      name: 'Customer App',
      parent: 'solar-portal',
      internal: false,
      issues: [],
    },
    {
      identifier: 'customer-web',
      name: 'Customer Web',
      parent: 'customer-app',
      internal: false,
      issues: [
        {
          subject: 'Live yield chart with 15-minute buckets',
          arc: 'closed-early',
          comments: [
            'Yield chart with 15-min buckets',
            'Bucket aggregation on the API side',
            'Chart a11y pass',
          ],
        },
        {
          subject: 'Invoice PDF download from the billing tab',
          arc: 'closed-early',
          comments: ['Invoice PDF endpoint', 'Billing tab download button + states'],
        },
        {
          subject: 'Onboarding wizard: skip the inverter step',
          arc: 'closed-mid',
          comments: ['Wizard step skipping logic', 'Copy review with Anna'],
        },
        {
          subject: 'Self-consumption vs export breakdown',
          arc: 'in-progress',
          comments: ['Self-consumption split query', 'Stacked bars on the dashboard'],
        },
        {
          subject: 'Compare production with the neighbourhood average',
          arc: 'in-progress',
          comments: ['Neighbourhood aggregate (anonymised)', 'Comparison card design'],
        },
        { subject: 'Export monthly report as CSV', arc: 'open-unlogged', comments: [] },
        { subject: 'Household consumption goals', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'customer-mobile',
      name: 'Customer Mobile',
      parent: 'customer-app',
      internal: false,
      issues: [
        {
          subject: 'Push alert on zero yield at noon',
          arc: 'closed-early',
          comments: ['Zero-yield detector', 'Push alert copy + deep link'],
        },
        {
          subject: 'Home-screen widget: today’s production',
          arc: 'closed-early',
          comments: ['iOS widget timeline', 'Android widget refresh cadence'],
        },
        {
          subject: 'Biometric login',
          arc: 'closed-mid',
          comments: ['Biometric unlock flow', 'Fallback to PIN'],
        },
        {
          subject: 'Inverter fault notifications',
          arc: 'in-progress',
          comments: ['Fault code mapping', 'Notification grouping per site'],
        },
        {
          subject: 'Offline mode for the daily summary',
          arc: 'in-progress',
          comments: ['Cache the last summary payload'],
        },
        { subject: 'Share a production screenshot', arc: 'open-unlogged', comments: [] },
        { subject: 'App rating prompt after a sunny week', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'gateway',
      name: 'Inverter Gateway',
      parent: 'solar-portal',
      internal: false,
      issues: [],
    },
    {
      identifier: 'gateway-modbus',
      name: 'Modbus Bridge',
      parent: 'gateway',
      internal: false,
      issues: [
        {
          subject: 'Polling backoff on Modbus timeouts',
          arc: 'closed-early',
          comments: ['Exponential backoff in the poller', 'Soak test on the bench inverter'],
        },
        {
          subject: 'Register map for SMA v3 inverters',
          arc: 'closed-early',
          comments: ['SMA v3 register map', 'Decoding the string-level registers'],
        },
        {
          subject: 'Batch reads for adjacent registers',
          arc: 'closed-mid',
          comments: ['Register batching', 'Throughput measurement'],
        },
        {
          subject: 'Fronius Symo support',
          arc: 'in-progress',
          comments: ['Fronius register map', 'Bench test with the loaner unit'],
        },
        {
          subject: 'Per-string current readings',
          arc: 'in-progress',
          comments: ['String current registers', 'Telemetry schema update'],
        },
        { subject: 'Huawei SUN2000 support', arc: 'open-unlogged', comments: [] },
        { subject: 'Modbus TCP over the customer LAN', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'gateway-rollout',
      name: 'Firmware Rollout',
      parent: 'gateway',
      internal: false,
      issues: [
        {
          subject: 'Staged rollout dashboard',
          arc: 'closed-early',
          comments: ['Rollout dashboard: cohorts + progress', 'Cohort selection rules'],
        },
        {
          subject: 'Rollback on checksum mismatch',
          arc: 'closed-early',
          comments: ['Checksum verification after flash', 'Automatic rollback path'],
        },
        {
          subject: 'Rollout pause when failure rate exceeds 2 %',
          arc: 'closed-mid',
          comments: ['Failure-rate guard', 'Alert to the ops channel'],
        },
        {
          subject: 'Delta updates to cut download size',
          arc: 'in-progress',
          comments: ['bsdiff patches', 'Patch apply on the gateway'],
        },
        {
          subject: 'Maintenance-window scheduling',
          arc: 'in-progress',
          comments: ['Window picker per site', 'Scheduler job'],
        },
        { subject: 'Rollout report per installer', arc: 'open-unlogged', comments: [] },
        { subject: 'Signed firmware manifests', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'grid-analytics',
      name: 'Grid Analytics',
      parent: null,
      internal: false,
      issues: [
        {
          subject: 'Hourly export to the DSO portal',
          arc: 'closed-early',
          comments: ['DSO export format', 'Hourly export job + retries'],
        },
        {
          subject: 'Curtailment forecast model v2',
          arc: 'closed-early',
          comments: ['Feature engineering for v2', 'Backtest against last summer'],
        },
        {
          subject: 'Feed-in tariff calculator',
          arc: 'closed-mid',
          comments: ['Tariff rules engine', 'Calculator UI'],
        },
        {
          subject: 'Weather-adjusted yield expectation',
          arc: 'in-progress',
          comments: ['Weather API integration', 'Expectation model calibration'],
        },
        {
          subject: 'Anomaly alerts for underperforming sites',
          arc: 'in-progress',
          comments: ['Site anomaly scoring', 'Alert thresholds review with ops'],
        },
        { subject: 'Portfolio view for installers', arc: 'open-unlogged', comments: [] },
        { subject: 'Battery dispatch simulation', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'helios-internal',
      name: 'Helios Internal',
      parent: null,
      internal: true,
      issues: [
        {
          subject: 'Quarterly access review',
          arc: 'closed-early',
          comments: ['Access review spreadsheet', 'Offboarding leftovers'],
        },
        {
          subject: 'Office network segmentation',
          arc: 'closed-mid',
          comments: ['VLAN plan for the workshop'],
        },
        {
          subject: 'Laptop refresh for the field team',
          arc: 'in-progress',
          comments: ['Laptop image + MDM enrolment', 'Handover to the field team'],
        },
        {
          subject: 'Backup restore drill',
          arc: 'in-progress',
          comments: ['Restore drill notes'],
        },
        { subject: 'New badge printer', arc: 'open-unlogged', comments: [] },
        { subject: 'Wiki cleanup', arc: 'open-unlogged', comments: [] },
      ],
    },
  ],
};
