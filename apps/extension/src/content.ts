import { WORKER_PORT_NAME } from './port-name.js';
import { acceptConnectEvent, pipePorts } from './content/bridge.js';

const windowRef = globalThis.window;

if (windowRef && windowRef === windowRef.top) {
  windowRef.addEventListener('message', (event: MessageEvent) => {
    const pagePort = acceptConnectEvent(
      {
        origin: event.origin,
        source: event.source,
        data: event.data,
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
