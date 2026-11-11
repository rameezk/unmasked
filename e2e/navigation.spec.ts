import { expect, test, type Page } from '@playwright/test';
import { characters } from '../src/characters/characters';

async function shownCharacter(page: Page) {
  const src = (await page.getByRole('img').getAttribute('src'))!;
  const file = src.replace(/^\//, '');
  const character = characters.find((c) => c.pictures.some((p) => p.file === file));
  if (!character) throw new Error(`No Character for ${src}`);
  return character;
}

async function answerCard(page: Page, index: number) {
  const character = await shownCharacter(page);
  await page.getByRole('button', { name: character.name, exact: true }).click();
  await page.getByRole('button', { name: index === 9 ? 'Finish' : 'Next' }).click();
}

async function playCards(page: Page, count: number) {
  for (let i = 0; i < count; i++) await answerCard(page, i);
}

async function openStart(page: Page, query = '?seed=1') {
  await page.goto(`/${query}`);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
}

async function expectStart(page: Page) {
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Card' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'End of Round' })).toHaveCount(0);
}

async function markPage(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { marker: string }).marker = 'still here';
  });
}

async function expectNotReloaded(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe(
    'still here',
  );
}

const logo = (page: Page) => page.getByRole('link', { name: 'unmasked' });

test.describe('Logo returns to Start', () => {
  test('leaves a Pick Round in progress without a reload, a hash or a change to Best Scores', async ({
    page,
  }) => {
    await openStart(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 10);
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.getByLabel('Pro').check();
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 2);
    await expect(page.getByText('3 / 10')).toBeVisible();
    await markPage(page);

    await logo(page).click();

    await expectStart(page);
    expect(new URL(page.url()).hash).toBe('');
    expect(new URL(page.url()).search).toBe('?seed=1');
    await expectNotReloaded(page);
    await expect(page.getByTestId('best-score')).toHaveText('No best yet');
    await page.getByLabel('Rookie').check();
    await expect(page.getByTestId('best-score')).toHaveText('10/10');
  });

  test('leaves a Type Round in progress and the next Round starts clean', async ({ page }) => {
    await openStart(page);
    await page.getByLabel('Type').check();
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('textbox').fill('half typed');

    await logo(page).click();
    await expectStart(page);
    await page.getByRole('button', { name: 'Play' }).click();

    await expect(page.getByText('1 / 10')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveValue('');
  });

  test('goes from the End of Round screen to Start with the Best Score recorded', async ({
    page,
  }) => {
    await openStart(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 10);
    await expect(page.getByTestId('score')).toHaveText('10/10');

    await logo(page).click();

    await expectStart(page);
    await expect(page.getByTestId('best-score')).toHaveText('10/10');
  });

  for (const [name, leave] of [
    ['the logo', (page: Page) => logo(page).click()],
    ['the Back link', (page: Page) => page.getByRole('link', { name: 'Back' }).click()],
  ] as const) {
    test(`goes from About to Start with ${name} and no hash`, async ({ page }) => {
      await openStart(page);
      await page.getByRole('link', { name: 'About' }).click();
      await expect(page.getByRole('region', { name: 'About' })).toBeVisible();
      await markPage(page);

      await leave(page);

      await expectStart(page);
      expect(new URL(page.url()).hash).toBe('');
      expect(new URL(page.url()).search).toBe('?seed=1');
      await expectNotReloaded(page);
    });
  }

  test('does nothing visible on Start', async ({ page }) => {
    await openStart(page);
    const before = page.url();
    await markPage(page);

    await logo(page).click();

    await expectStart(page);
    expect(page.url()).toBe(before);
    await expectNotReloaded(page);
  });
});

test.describe('Browser back returns to Start', () => {
  test('starting a Round leaves the address alone', async ({ page }) => {
    await openStart(page);
    const before = page.url();

    await page.getByRole('button', { name: 'Play' }).click();

    await expect(page.getByRole('region', { name: 'Card' })).toBeVisible();
    expect(page.url()).toBe(before);
  });

  test('one press leaves a Round on any Card without recording its Score', async ({ page }) => {
    await openStart(page);
    const before = page.url();
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 4);
    await markPage(page);

    await page.goBack();

    await expectStart(page);
    expect(page.url()).toBe(before);
    await expectNotReloaded(page);
    await expect(page.getByTestId('best-score')).toHaveText('No best yet');
  });

  test('one press leaves the End of Round screen', async ({ page }) => {
    await openStart(page);
    const before = page.url();
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 10);
    await expect(page.getByTestId('score')).toHaveText('10/10');

    await page.goBack();

    await expectStart(page);
    expect(page.url()).toBe(before);
  });

  test('forward does not revive a Round', async ({ page }) => {
    await openStart(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 2);
    await page.goBack();
    await expectStart(page);

    await page.goForward();

    await expectStart(page);
  });

  test('back from Start leaves the app after leaving a Round with the logo', async ({ page }) => {
    await page.goto('about:blank');
    await openStart(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 3);
    await logo(page).click();
    await expectStart(page);

    await page.goBack();

    expect(page.url()).toBe('about:blank');
  });

  test('back from Start leaves the app after a reload mid-Round and a later Round left by the logo', async ({
    page,
  }) => {
    await page.goto('about:blank');
    await openStart(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 2);
    await page.reload();
    await expectStart(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await logo(page).click();
    await expectStart(page);

    await page.goBack();

    expect(page.url()).toBe('about:blank');
  });

  test('back from Start leaves the app after Play again', async ({ page }) => {
    await page.goto('about:blank');
    await openStart(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await playCards(page, 10);
    await page.getByRole('button', { name: 'Play again' }).click();
    await expectStart(page);

    await page.goBack();

    expect(page.url()).toBe('about:blank');
  });
});

test.describe('Logo press feedback', () => {
  test('shifts down-right like the buttons when pressed and has no hover effect', async ({
    page,
  }) => {
    await openStart(page);
    const transform = () => logo(page).evaluate((el) => getComputedStyle(el).transform);
    const rest = await transform();

    await logo(page).hover();
    expect(await transform()).toBe(rest);

    await page.mouse.down();
    await expect.poll(transform).toBe('matrix(1, 0, 0, 1, 3, 3)');

    await page.mouse.up();
    await expect.poll(transform).toBe(rest);
  });
});
