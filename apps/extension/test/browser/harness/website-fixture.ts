import { createServer, type Server } from 'node:http';

export interface WebsiteFixture {
  origin: string;
  url: string;
  close: () => Promise<void>;
}

const PAGE = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>OSI extension fixture</title></head>
  <body>
    <p data-testid="fixture-ready">ready</p>
    <script>
      const CHANNEL = 'osi-extension-protocol';
      const PROTOCOL_VERSION = 1;
      window.__osiLast = null;
      window.__osiRun = async function (message) {
        const channel = new MessageChannel();
        channel.port1.start();
        const reply = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('fixture timeout')), 8000);
          channel.port1.addEventListener('message', (event) => {
            clearTimeout(timer);
            window.__osiLast = event.data;
            resolve(event.data);
          });
        });
        window.postMessage(
          { channel: CHANNEL, type: 'connect', protocolVersion: PROTOCOL_VERSION },
          window.location.origin,
          [channel.port2],
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
        channel.port1.postMessage(message);
        return reply;
      };
    </script>
  </body>
</html>`;

export function startWebsiteFixture(): Promise<WebsiteFixture> {
  const server: Server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(PAGE);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || !('port' in address)) {
        reject(new Error('website fixture missing port'));
        return;
      }
      const origin = `http://127.0.0.1:${address.port}`;
      resolve({
        origin,
        url: `${origin}/`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error);
              else closeResolve();
            });
          }),
      });
    });
  });
}
