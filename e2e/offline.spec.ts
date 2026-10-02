import { expect, test, type Page } from '@playwright/test';
import { characters } from '../src/characters/characters';

const pictureFiles = characters.flatMap((c) => c.pictures.map((p) => p.file));

async function precached(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(
      () =>
        page.evaluate(async (files) => {
          const hits = await Promise.all(
            files.map((f) => caches.match(`/${f}`, { ignoreSearch: true })),
          );
          return hits.filter((h) => !h).length;
        }, pictureFiles),
      { timeout: 30_000 },
    )
    .toBe(0);
}

async function playRound(page: Page) {
  await page.getByLabel('Pick').check();
  await page.getByLabel('Legend').check();
  await page.getByRole('button', { name: 'Play' }).click();
  for (let i = 0; i < 10; i++) {
    const img = page.getByRole('img');
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    const src = (await img.getAttribute('src'))!.replace(/^\//, '');
    const character = characters.find((c) => c.pictures.some((p) => p.file === src))!;
    await page.getByRole('button', { name: character.name, exact: true }).click();
    await page.getByRole('button', { name: i === 9 ? 'Finish' : 'Next' }).click();
  }
  await expect(page.getByTestId('score')).toHaveText('10/10');
}

test('a full Round plays offline after one visit', async ({ page, context }) => {
  await page.goto('/?seed=3');
  await precached(page);
  await context.setOffline(true);
  await page.goto('/?seed=3');
  await playRound(page);
});

test('every Picture is precached on the first visit', async ({ page }) => {
  await page.goto('/');
  await precached(page);
});

test('the app is installable with a name and icons', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  for (const icon of manifest.icons) {
    const res = await page.request.get(new URL(icon.src, page.url()).href);
    expect(res.ok()).toBe(true);
  }
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});
