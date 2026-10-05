// Cut once from apps/web/public/favicon.svg and committed under public/icons. Re-cut them whenever
// the canonical glyph (apps/web/app/assets/icons/app-mark.svg) changes, for each size n:
//   pnpx sharp-cli@5 --density 1200 -i apps/web/public/favicon.svg \
//     -o apps/extension/public/icons/icon-<n>.png resize <n> <n>
const icons = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png',
} as const;

export const extensionManifest = {
  manifest_version: 3,
  name: 'OSI Time Tracker',
  version: '0.1.0',
  description: 'Run OSI Time Tracker remote operations through the desktop browser network.',
  icons,
  // activeTab: the popup reads the current tab's address only after the user opens it (REQ-415).
  permissions: ['storage', 'scripting', 'activeTab'],
  optional_host_permissions: ['http://*/*', 'https://*/*'],
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_title: 'OSI Time Tracker',
    default_icon: icons,
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
