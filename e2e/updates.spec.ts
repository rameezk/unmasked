import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';

import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { expect, test } from '@playwright/test';

const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

let root = '';
let current = '';
let server: Server;
let origin = '';

function build(id: string) {
  const outDir = join(root, id);
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    env: { ...process.env, VITE_BUILD_ID: id },
    stdio: 'pipe',
  });
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  root = mkdtempSync(join(tmpdir(), 'unmasked-'));
  build('one');
  build('two');
  current = 'one';
  server = createServer((req, res) => {
    const path = normalize(new URL(req.url!, 'http://x').pathname);
    let file = join(root, current, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, current, 'index.html');
    res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
    res.setHeader('cache-control', 'no-cache');
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(root, { recursive: true, force: true });
});

test.skip(({ isMobile }) => isMobile, 'one project is enough');

test('a newer build replaces the cached version on a later visit', async ({ page }) => {
  const builtId = () => page.locator('meta[name="build"]').getAttribute('content');
  await page.goto(origin);
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(await builtId()).toBe('one');
  current = 'two';
  await expect
    .poll(
      async () => {
        await page.goto(origin).catch(() => undefined);
        await page.waitForLoadState('load');
        return builtId();
      },
      { timeout: 30_000 },
    )
    .toBe('two');
});
