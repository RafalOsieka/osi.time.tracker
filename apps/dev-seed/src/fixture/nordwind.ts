import type { ClientFixture } from './types.js';

/**
 * Nordwind Logistics — a regional freight carrier running Redmine. The
 * consultant works on their fleet platform (dispatching + telemetry), a
 * warehouse scanning app, and occasionally their internal IT tickets.
 */
export const NORDWIND: ClientFixture = {
  tracker: 'redmine',
  clientName: 'Nordwind Logistics',
  activities: ['Development', 'Design'],
  projects: [
    {
      identifier: 'fleet-platform',
      name: 'Fleet Platform',
      parent: null,
      internal: false,
      issues: [],
    },
    {
      identifier: 'dispatch',
      name: 'Dispatch',
      parent: 'fleet-platform',
      internal: false,
      issues: [],
    },
    {
      identifier: 'dispatch-web',
      name: 'Dispatch Web',
      parent: 'dispatch',
      internal: false,
      issues: [
        {
          subject: 'Route planner: drag-to-reorder stops',
          arc: 'closed-early',
          comments: [
            'Reorder API + optimistic UI',
            'Playwright coverage for stop reordering',
            'Keyboard reorder with alt+arrows',
          ],
        },
        {
          subject: 'Warn dispatcher when driver shifts overlap',
          arc: 'closed-early',
          comments: ['Overlap detection in shift service', 'Toast + inline warning on the roster'],
        },
        {
          subject: 'Export daily manifests to PDF',
          arc: 'closed-mid',
          comments: ['Manifest layout in wkhtmltopdf', 'Batch export for a whole depot'],
        },
        {
          subject: 'Recalculate ETAs from live traffic feed',
          arc: 'in-progress',
          comments: ['ETA recompute job every 5 min', 'Pairing with Marek on the traffic rules'],
        },
        {
          subject: 'Bulk reassign vehicles between depots',
          arc: 'in-progress',
          comments: ['Multi-select on the vehicle grid', 'Reassign endpoint + audit row'],
        },
        {
          subject: 'Dispatcher keyboard shortcuts cheat-sheet',
          arc: 'open-unlogged',
          comments: [],
        },
        { subject: 'Print-friendly day sheet for drivers', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'dispatch-mobile',
      name: 'Dispatch Mobile',
      parent: 'dispatch',
      internal: false,
      issues: [
        {
          subject: 'Offline route cache on Android',
          arc: 'closed-early',
          comments: ['SQLite route cache + sync marker', 'Cold-start with cached route'],
        },
        {
          subject: 'Signature capture for proof of delivery',
          arc: 'closed-early',
          comments: ['Canvas signature pad', 'Upload retry when the depot wifi drops'],
        },
        {
          subject: 'Push notification on route change',
          arc: 'closed-mid',
          comments: ['FCM topic per driver', 'Silent push when the app is foregrounded'],
        },
        {
          subject: 'Photo evidence for damaged parcels',
          arc: 'in-progress',
          comments: ['Camera intent + compression', 'Attach photos to the delivery record'],
        },
        {
          subject: 'Battery-friendly GPS sampling',
          arc: 'in-progress',
          comments: ['Adaptive sampling interval', 'Field test with two drivers'],
        },
        { subject: 'Dark mode for night shifts', arc: 'open-unlogged', comments: [] },
        { subject: 'Driver break timer', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'telemetry',
      name: 'Telemetry',
      parent: 'fleet-platform',
      internal: false,
      issues: [],
    },
    {
      identifier: 'telemetry-api',
      name: 'Telemetry API',
      parent: 'telemetry',
      internal: false,
      issues: [
        {
          subject: 'Deduplicate GPS pings within 2 seconds',
          arc: 'closed-early',
          comments: [
            'Ping dedup window in the ingest handler',
            'Load test with the replayed February feed',
          ],
        },
        {
          subject: 'Rate-limit /ingest per vehicle',
          arc: 'closed-early',
          comments: ['Token bucket per vehicle id', 'Return 429 with retry-after'],
        },
        {
          subject: 'Move ingest store to PostgreSQL 18',
          arc: 'closed-mid',
          comments: [
            'Migration plan + dry run',
            'Cutover night with Ola',
            'uuidv7 keys on the ping table',
          ],
        },
        {
          subject: 'Geofence enter/leave events',
          arc: 'in-progress',
          comments: ['Geofence matcher on ingest', 'Event fan-out to the dispatch queue'],
        },
        {
          subject: 'Vehicle health endpoint (odometer, fuel, faults)',
          arc: 'in-progress',
          comments: ['Health aggregation query', 'Contract review with the mobile team'],
        },
        { subject: 'OpenAPI spec for the telemetry endpoints', arc: 'open-unlogged', comments: [] },
        {
          subject: 'Replay endpoint for support investigations',
          arc: 'open-unlogged',
          comments: [],
        },
      ],
    },
    {
      identifier: 'telemetry-etl',
      name: 'Telemetry ETL',
      parent: 'telemetry',
      internal: false,
      issues: [
        {
          subject: 'Nightly trip aggregation job',
          arc: 'closed-early',
          comments: ['Trip segmentation by ignition events', 'Airflow DAG + alerts'],
        },
        {
          subject: 'Backfill March odometer gaps',
          arc: 'closed-early',
          comments: ['Gap detection query', 'Backfill script run on staging'],
        },
        {
          subject: 'Fuel consumption per route report',
          arc: 'closed-mid',
          comments: ['Fuel model per vehicle class', 'Report export to the BI bucket'],
        },
        {
          subject: 'Idle time detection',
          arc: 'in-progress',
          comments: [
            'Idle heuristic (engine on, speed 0, > 5 min)',
            'Validation against dispatcher notes',
          ],
        },
        {
          subject: 'Driver scorecard warehouse table',
          arc: 'in-progress',
          comments: ['Scorecard dimensions', 'Weekly rollup job'],
        },
        { subject: 'Archive raw pings older than 12 months', arc: 'open-unlogged', comments: [] },
        { subject: 'Data quality dashboard', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'warehouse-scanner',
      name: 'Warehouse Scanner',
      parent: null,
      internal: false,
      issues: [
        {
          subject: 'Barcode focus on low-end Android devices',
          arc: 'closed-early',
          comments: [
            'Autofocus workaround for the Zebra TC21',
            'Regression pass on the depot devices',
          ],
        },
        {
          subject: 'Offline queue replay after reconnect',
          arc: 'closed-early',
          comments: ['Persist scan queue', 'Replay with idempotency keys'],
        },
        {
          subject: 'Pallet count discrepancies report',
          arc: 'closed-mid',
          comments: ['Discrepancy query per shift', 'CSV export for the depot leads'],
        },
        {
          subject: 'Multi-parcel scan for pallets',
          arc: 'in-progress',
          comments: ['Continuous scan mode', 'Duplicate scan guard'],
        },
        {
          subject: 'Damaged label fallback (manual entry)',
          arc: 'in-progress',
          comments: ['Manual entry form with checksum', 'Supervisor approval step'],
        },
        { subject: 'Bluetooth ring scanner support', arc: 'open-unlogged', comments: [] },
        { subject: 'Shift handover summary screen', arc: 'open-unlogged', comments: [] },
      ],
    },
    {
      identifier: 'internal-it',
      name: 'Internal IT',
      parent: null,
      internal: true,
      issues: [
        {
          subject: 'Rotate VPN certificates',
          arc: 'closed-early',
          comments: ['Cert rotation runbook', 'Rollout to the depot routers'],
        },
        {
          subject: 'Move the wiki to the new host',
          arc: 'closed-mid',
          comments: ['Wiki migration + redirects'],
        },
        {
          subject: 'Onboard the new dispatcher laptops',
          arc: 'in-progress',
          comments: ['Laptop image + VPN profile', 'Handover session'],
        },
        {
          subject: 'Quarterly access review',
          arc: 'in-progress',
          comments: ['Access review spreadsheet'],
        },
        { subject: 'Replace the depot printer', arc: 'open-unlogged', comments: [] },
        { subject: 'Password manager rollout', arc: 'open-unlogged', comments: [] },
      ],
    },
  ],
};
