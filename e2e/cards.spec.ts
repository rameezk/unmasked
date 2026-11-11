import { expect, test, type Page } from '@playwright/test';
import { characters } from '../src/characters/characters';

const more = (page: Page) => page.getByRole('button', { name: '+', exact: true });
const fewer = (page: Page) => page.getByRole('button', { name: '−', exact: true });
const cards = (page: Page) => page.getByTestId('cards');

async function stepUp(page: Page) {
  while (await more(page).isEnabled()) await more(page).click();
}

test('a fresh load starts at 10 Cards with both stepper buttons enabled and no best', async ({
  page,
}) => {
  await page.goto('/?seed=1');
  await expect(cards(page)).toHaveText('10');
  await expect(fewer(page)).toBeEnabled();
  await expect(more(page)).toBeEnabled();
  await expect(page.getByTestId('best-score')).toHaveText('No best yet');
});

test('the stepper moves through the listed numbers and stops at 100 under Legend', async ({
  page,
}) => {
  await page.goto('/?seed=1');
  await page.getByLabel('Legend').check();
  for (const expected of ['20', '30', '50', '75', '100']) {
    await more(page).click();
    await expect(cards(page)).toHaveText(expected);
  }
  await expect(more(page)).toBeDisabled();
});

test('the stepper stops at what the Pool can fill', async ({ page }) => {
  await page.goto('/?seed=1');
  await stepUp(page);
  await expect(cards(page)).toHaveText('30');
  await page.getByLabel('Pro').check();
  await stepUp(page);
  await expect(cards(page)).toHaveText('75');
});

test('the minus button stops at 5', async ({ page }) => {
  await page.goto('/?seed=1');
  await fewer(page).click();
  await expect(cards(page)).toHaveText('5');
  await expect(fewer(page)).toBeDisabled();
});

test('switching to a smaller Pool lowers Cards and it stays lowered', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.getByLabel('Pro').check();
  await stepUp(page);
  await expect(cards(page)).toHaveText('75');
  await page.getByLabel('Rookie').check();
  await expect(cards(page)).toHaveText('30');
  await page.getByLabel('Pro').check();
  await expect(cards(page)).toHaveText('30');
});

test('a disabled stepper button is grey without a line-through', async ({ page }) => {
  await page.goto('/?seed=1');
  await fewer(page).click();
  await expect(fewer(page)).toBeDisabled();
  await expect(fewer(page)).toHaveCSS('background-color', 'rgb(221, 221, 221)');
  await expect(fewer(page)).toHaveCSS('text-decoration-line', 'none');
});

async function chooseCards(page: Page, count: string) {
  while ((await cards(page).textContent()) !== count) {
    if (Number(await cards(page).textContent()) < Number(count)) await more(page).click();
    else await fewer(page).click();
  }
}

async function shownCharacterId(page: Page) {
  const src = (await page.getByRole('img').getAttribute('src'))!;
  const character = characters.find((c) =>
    c.pictures.some((p) => p.file === src.replace(/^\//, '')),
  );
  return character!;
}

test('a Round has the chosen number of distinct Cards and the Score is out of it', async ({
  page,
}) => {
  await page.goto('/?seed=1');
  await page.getByLabel('Legend').check();
  await chooseCards(page, '20');
  await page.getByRole('button', { name: 'Play' }).click();
  const seen: string[] = [];
  for (let i = 0; i < 20; i++) {
    await expect(page.getByText(`${i + 1} / 20`)).toBeVisible();
    const character = await shownCharacterId(page);
    seen.push(character.id);
    await page.getByRole('button', { name: character.name, exact: true }).click();
    await page.getByRole('button', { name: i === 19 ? 'Finish' : 'Next' }).click();
  }
  expect(new Set(seen).size).toBe(20);
  await expect(page.getByTestId('score')).toHaveText('20/20');
  await expect(page.getByTestId('round-character')).toHaveCount(20);
});

async function playFive(page: Page, correct: number) {
  for (let i = 0; i < 5; i++) {
    const character = await shownCharacterId(page);
    if (i >= correct) {
      const names = await page.getByTestId('choice').allTextContents();
      const wrong = names.map((n) => n.trim()).find((n) => n !== character.name)!;
      await page.getByRole('button', { name: wrong, exact: true }).click();
    }
    await page.getByRole('button', { name: character.name, exact: true }).click();
    await page.getByRole('button', { name: i === 4 ? 'Finish' : 'Next' }).click();
  }
}

test('Cards are not remembered and the Best Score follows the selection', async ({ page }) => {
  await page.goto('/?seed=1');
  await chooseCards(page, '5');
  await page.getByRole('button', { name: 'Play' }).click();
  await playFive(page, 4);
  await expect(page.getByTestId('score')).toHaveText('4/5');
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(cards(page)).toHaveText('5');
  await expect(page.getByTestId('best-score')).toHaveText('4/5');
  await more(page).click();
  await expect(page.getByTestId('best-score')).toHaveText('No best yet');
  await page.reload();
  await expect(cards(page)).toHaveText('10');
  await expect(page.getByTestId('best-score')).toHaveText('No best yet');
});

test('a best saved before Cards were chosen shows as Cards 10', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('unmasked:v1', JSON.stringify({ best: { 'pick:rookie': 7 } })),
  );
  await page.goto('/?seed=1');
  await expect(cards(page)).toHaveText('10');
  await expect(page.getByTestId('best-score')).toHaveText('7/10');
});

test('the Score fits inside its circle on a 100 Card Round', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.getByLabel('Legend').check();
  await chooseCards(page, '100');
  await page.getByRole('button', { name: 'Play' }).click();
  for (let i = 0; i < 100; i++) {
    const character = await shownCharacterId(page);
    if (i < 79) {
      const names = await page.getByTestId('choice').allTextContents();
      const wrong = names.map((n) => n.trim()).find((n) => n !== character.name)!;
      await page.getByRole('button', { name: wrong, exact: true }).click();
    }
    await page.getByRole('button', { name: character.name, exact: true }).click();
    await page.getByRole('button', { name: i === 99 ? 'Finish' : 'Next' }).click();
  }
  const score = page.getByTestId('score');
  await expect(score).toHaveText('21/100');
  await page.waitForTimeout(1000);
  const { radius, reach } = await score.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    return {
      radius: box.width / 2,
      reach: Math.hypot(text.width / 2, text.height / 2),
    };
  });
  expect(reach).toBeLessThan(radius);
});
