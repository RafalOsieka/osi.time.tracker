# Connecting trackers

## Reaching your trackers

The OSI server never contacts your trackers. Every tracker request is made by **your browser**, either directly or through the browser extension, using an API key that is stored only in that browser. This means:

- The device you use OSI on must reach the tracker, publicly or over VPN. If a tracker is only on a VPN, connect that device to the VPN.
- **Direct browser access** additionally requires the tracker to allow cross-origin requests from the OSI origin (CORS).
- When CORS blocks direct access, turn off **Direct browser connection allowed** for that tracker and use the browser extension instead. There is no automatic fallback.

## Browser extension (Chrome / Edge)

The extension is built and loaded locally from a clone of the repository (Node.js and pnpm required, see [`development.md`](./development.md#prerequisites)).

```bash
pnpm install
pnpm build:packages
pnpm --filter @osi/time-tracker-extension build
```

1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked** and select `apps/extension/dist`.
2. Open OSI, click the extension's toolbar icon and choose **Approve <website>** (the button names the open tab's website) to approve it on the setup page (or enter its address, e.g. `https://time.example.com`, there yourself). HTTP trackers are marked as unencrypted and need an explicit **Approve despite HTTP**.
3. In OSI, turn off **Direct browser connection allowed** on the trackers that should go through the extension, then refresh the OSI tab.
4. Approve each tracker. Either enter its base URL on the setup page, or open the extension status in the OSI sidebar and choose **Request approval in extension** next to the tracker: the request appears in the extension (the toolbar icon shows a count), and you approve or dismiss it there.

The popup and the setup page show each tracker's latest request (time, operation and outcome) for the current browser session, which helps when a sync fails.

The web app and the extension must come from the same version of the repository: after updating OSI, rebuild the extension, click **Reload** on the extension card and refresh the OSI tab. If OSI reports an incompatible extension, rebuild and reload it. Workplace policies that block unpacked extensions or host permissions cannot be bypassed.

API keys stay in the website's `localStorage` and are passed to the extension only for the current request; the extension never stores them. To stop using the extension, turn **Direct browser connection allowed** back on (if the tracker allows CORS) and remove the extension. Local time entries are unaffected.
