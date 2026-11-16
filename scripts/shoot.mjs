/**
 * A small headless-Chrome driver for local checks and for rendering the feed card's hero images.
 * Needs Google Chrome and the local server (`npm run debug`). Not part of the build.
 *
 *   node scripts/shoot.mjs <url> <out.png> [steps.json] [WIDTHxHEIGHT]
 *
 * steps.json is a list of { js, wait }: each `js` runs in the page, then `wait` ms pass.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME =
  process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Open a page, run `use(page)`, close. `page.run(js)` evaluates; `page.shot(file)` saves a PNG. */
export async function withPage(url, { width, height, scale = 2 }, use) {
  const port = 9300 + Math.floor(Math.random() * 400);
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lumen-shoot-'))}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  try {
    let target;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(200);
      try {
        const list = await (
          await fetch(`http://127.0.0.1:${port}/json`)
        ).json();
        target = list.find((entry) => entry.type === 'page');
      } catch {
        // Chrome is still starting.
      }
    }
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener('open', resolve));
    let id = 0;
    const waiting = new Map();
    const logs = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled')
        logs.push(
          `${message.params.type}: ${message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')}`
        );
      if (message.method === 'Runtime.exceptionThrown')
        logs.push(`exception: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
    });
    const send = (method, params = {}) =>
      new Promise((resolve) => {
        id++;
        waiting.set(id, resolve);
        socket.send(JSON.stringify({ id, method, params }));
      });
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: width < 600,
    });
    await send('Runtime.enable');
    await send('Page.navigate', { url });
    await sleep(3500);
    const page = {
      sleep,
      /** Console messages and uncaught errors from the page so far. */
      logs: () => logs.slice(),
      async run(js) {
        const answer = await send('Runtime.evaluate', {
          expression: js,
          awaitPromise: true,
          returnByValue: true,
        });
        if (answer.result?.exceptionDetails)
          throw new Error(
            answer.result.exceptionDetails.exception?.description ??
              'page error'
          );
        return answer.result?.result?.value;
      },
      async shot(file) {
        const image = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(file, Buffer.from(image.result.data, 'base64'));
      },
    };
    const result = await use(page);
    socket.close();
    return result;
  } finally {
    chrome.kill();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [url, out, stepsFile, size = '430x701'] = process.argv.slice(2);
  const [width, height] = size.split('x').map(Number);
  const steps = stepsFile ? JSON.parse(readFileSync(stepsFile, 'utf8')) : [];
  await withPage(url, { width, height }, async (page) => {
    for (const step of steps) {
      if (step.js) {
        const value = await page.run(step.js);
        if (value !== undefined) console.log(JSON.stringify(value));
      }
      await page.sleep(step.wait ?? 500);
    }
    await page.shot(out);
  });
}
