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
  const connections = new Set<() => void>();
  windowRef.addEventListener('pagehide', () => {
    for (const close of connections) close();
  });
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
    try {
      const workerPort = chrome.runtime.connect({ name: WORKER_PORT_NAME });
      const close = pipePorts(pagePort, workerPort, () => connections.delete(close));
      connections.add(close);
    } catch {
      pagePort.close();
    }
  });
}
