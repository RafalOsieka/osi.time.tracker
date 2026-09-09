export const extensionManifest = {
  manifest_version: 3,
  name: 'OSI Time Tracker',
  version: '0.1.0',
  description: 'Run OSI Time Tracker remote operations through the desktop browser network.',
  permissions: ['storage', 'scripting'],
  optional_host_permissions: ['http://*/*', 'https://*/*'],
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_title: 'OSI Time Tracker',
    default_popup: 'src/popup/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
} as const;
