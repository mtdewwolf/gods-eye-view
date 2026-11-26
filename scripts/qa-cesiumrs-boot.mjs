#!/usr/bin/env node
/**
 * Boot the full gods-eye-view application on the Phase 1 CesiumRS WebGL2/WASM
 * renderer (`dev/cesiumrs-app/main.js`) in headless Chromium (SwiftShader),
 * and verify:
 * - Zero CesiumJS modules/workers/assets are loaded.
 * - `checkRendererShape` passes on the live CesiumRS renderer.
 * - WebGL2 renders real non-blank pixels into the canvas (`readPixels()`).
 * - The application's own credits line is visible with data credits.
 * - Every data layer turns on and off cleanly without page or console errors.
 *
 *   npm run qa:cesiumrs-boot [-- --port 5291] [--settle-ms 8000]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { STUB_BOOT_LAYERS } from './qa-stub-boot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const isCesiumJsRequest = (url) => {
  const p = new URL(url).pathname;
  if (p.includes('cesiumrs') || p.includes('cesium-rs') || p.includes('cesium_rs') || p.includes('CesiumRS'))
    return false;
  return /(?:^|[/._-])cesium(?:[/._-]|$)/i.test(p);
};

const isPluginStylesheet = (url, type) =>
  type === 'stylesheet' &&
  new URL(url).pathname === '/cesium/Widgets/widgets.css';

const isFailedResponse = (text, at, base) => {
  if (!/^Failed to load resource:/.test(text)) return false;
  try {
    const url = new URL(at);
    return (
      url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')
    );
  } catch {
    return false;
  }
};

const isDevClient = (at, text) => {
  if (
    /\[vite\] failed to connect to websocket|ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS/i.test(
      text,
    )
  )
    return true;
  try {
    return new URL(at).pathname === '/@vite/client';
  } catch {
    return false;
  }
};

function parseArgs(argv) {
  const args = { port: 5291, settleMs: 6_000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port') args.port = Number(argv[++i]);
    else if (arg === '--settle-ms') args.settleMs = Number(argv[++i]);
    else if (arg === '--url') args.url = argv[++i];
  }
  return args;
}

async function startViteServer(port) {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.js'),
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
    logLevel: 'warn',
  });
  await server.listen();
  return server;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const server = args.url ? null : await startViteServer(args.port);
  const base = (args.url ?? `http://127.0.0.1:${args.port}`).replace(/\/$/, '');
  let browser;
  const errors = [];
  const cesiumJsRequests = [];
  const problems = [];

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        (await puppeteer.executablePath()),
      defaultViewport: { width: 1280, height: 800 },
      protocolTimeout: 300_000,
      args: [
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    });
    const page = await browser.newPage();
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      const at = message.location()?.url ?? null;
      if (isFailedResponse(text, at, base) || isDevClient(at, text)) return;
      errors.push({ kind: 'console', text, at });
    });
    page.on('pageerror', (error) =>
      errors.push({ kind: 'page', text: String(error?.stack || error) }),
    );
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      const url = request.url();
      if (url.startsWith(base) && isCesiumJsRequest(url)) {
        cesiumJsRequests.push(url);
      }
      if (request.isNavigationRequest() && url.startsWith(base)) {
        const response = await fetch(url);
        const html = (await response.text()).replace(
          'src="/src/main.js"',
          'src="/dev/cesiumrs-app/main.js"',
        );
        await request.respond({
          status: response.status,
          contentType: 'text/html',
          body: html,
        });
        return;
      }
      await request.continue();
    });

    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 180_000 });
    await page.waitForFunction(() => window.__cesiumRsBoot, {
      timeout: 180_000,
    });
    const started = await page.evaluate(() => window.__cesiumRsBoot.started);
    if (!started.ok) throw new Error(`Startup failed: ${started.error}`);

    await page.waitForFunction(() => window.__godsEyeView?.dataManager, {
      timeout: 60_000,
    });

    // Give WebGL2 a couple of frames to render the globe.
    await new Promise((r) => setTimeout(r, 1500));

    const check = await page.evaluate(async () => {
      const { checkRendererShape } = await import(
        '/src/render/contract/index.js'
      );
      const r = window.__cesiumRsBoot.renderers[0];
      r.frame.renderNow();
      const img = r.readPixels();
      let nonBlack = 0;
      const uniqueColors = new Set();
      for (let i = 0; i < img.data.length; i += 16) {
        const rr = img.data[i];
        const gg = img.data[i + 1];
        const bb = img.data[i + 2];
        if (rr > 0 || gg > 0 || bb > 0) nonBlack += 1;
        if (uniqueColors.size < 32) uniqueColors.add((rr << 16) | (gg << 8) | bb);
      }
      const line = document.getElementById('gev-credits');
      const box = line?.getBoundingClientRect();
      return {
        id: r.id,
        shapeProblems: checkRendererShape(r),
        canvasInPage: document.contains(r.canvas),
        pixelDims: [img.width, img.height],
        nonBlackSamples: nonBlack,
        uniqueColors: uniqueColors.size,
        renderedFrames: r.frame.diagnostics().rendered,
        creditsVisible: Boolean(box && box.width > 0 && box.height > 0),
        creditsText: line?.textContent ?? null,
      };
    });

    console.log('renderer:', JSON.stringify(check));
    if (check.shapeProblems.length)
      problems.push(`shape: ${check.shapeProblems.join(', ')}`);
    if (!check.canvasInPage) problems.push('canvas not in page');
    if (check.nonBlackSamples === 0)
      problems.push('canvas rendered all black pixels');
    if (!check.creditsVisible) problems.push('credits line not visible');
    if (cesiumJsRequests.length)
      problems.push(`CesiumJS requested: ${cesiumJsRequests.join(', ')}`);

    // Toggle each data layer on and off (with a bounded wait so slow network feeds don't stall).
    const known = await page.evaluate(() =>
      window.__godsEyeView.dataManager.getAll().map((l) => l.id),
    );
    for (const id of STUB_BOOT_LAYERS) {
      if (!known.includes(id)) continue;
      const okOn = await page.evaluate(
        (layerId) =>
          window.__godsEyeView.dataManager
            .setEnabled(layerId, true, { origin: 'user' })
            .then(
              (v) =>
                v !== false &&
                window.__godsEyeView.dataManager.isEnabled(layerId),
              (e) => `err:${e?.message ?? e}`,
            ),
        id,
      );
      await new Promise((r) => setTimeout(r, 150));
      const okOff = await page.evaluate(
        (layerId) =>
          window.__godsEyeView.dataManager
            .setEnabled(layerId, false, { origin: 'user' })
            .then(
              (v) =>
                v !== false &&
                !window.__godsEyeView.dataManager.isEnabled(layerId),
              (e) => `err:${e?.message ?? e}`,
            ),
        id,
      );
      console.log(`layer ${id}: on=${okOn} off=${okOff}`);
      if (okOn !== true || okOff !== true)
        problems.push(`layer ${id} toggle failed (on=${okOn}, off=${okOff})`);
    }

    if (errors.length) {
      for (const e of errors) console.error(`${e.kind} error: ${e.text}`);
      problems.push(`${errors.length} page/console error(s)`);
    }
  } finally {
    await browser?.close();
    await server?.close();
  }

  if (problems.length) {
    console.error(`FAIL: ${problems.join('; ')}`);
    process.exitCode = 1;
  } else {
    console.log('ok: gods-eye-view boots and renders on CesiumRS (Phase 1) with zero CesiumJS requests');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
