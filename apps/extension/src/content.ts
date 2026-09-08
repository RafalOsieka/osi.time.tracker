import type { JsonValue } from '@osi/remote-trackers/contracts';
import { WORKER_PORT_NAME } from './port-name.js';
import { acceptConnectEvent, pipePorts } from './content/bridge.js';

const windowRef = globalThis.window;

function cloneEventData(data: JsonValue): JsonValue | undefined {
  try {
    // SAFETY: JSON.parse of JSON.stringify always yields a JSON value.
    return JSON.parse(JSON.stringify(data)) as JsonValue;
  } catch {
    return undefined;
  }
}

if (windowRef && windowRef === windowRef.top) {
  windowRef.addEventListener('message', (event: MessageEvent<JsonValue>) => {
    const source = event.source;
    if (!(source instanceof Object)) return;
    const data = cloneEventData(event.data);
    if (data === undefined) return;
    const pagePort = acceptConnectEvent(
      {
        origin: event.origin,
        source,
        data,
        ports: [...event.ports],
      },
      {
        expectedOrigin: windowRef.location.origin,
        source: windowRef,
        isTopFrame: windowRef === windowRef.top,
      },
    );
    if (!pagePort) return;
    const workerPort = chrome.runtime.connect({ name: WORKER_PORT_NAME });
    pipePorts(pagePort, workerPort);
  });
}
