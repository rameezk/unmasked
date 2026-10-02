import { expect, test, type Page } from '@playwright/test';
import { characters } from '../src/characters/characters';

async function start(page: Page, pool: string, seed = 1) {
  await page.goto(`/?seed=${seed}`);
  await page.getByLabel('Pick').check();
  await page.getByLabel(pool).check();
  await page.getByRole('button', { name: 'Play' }).click();
}

async function shownCharacter(page: Page) {
  const src = (await page.getByRole('img').getAttribute('src'))!;
  const file = src.replace(/^\//, '');
  const character = characters.find((c) => c.pictures.some((p) => p.file === file));
  if (!character) throw new Error(`No Character for ${src}`);
  return character;
}

async function choiceNames(page: Page) {
  const names = await page.getByTestId('choice').allTextContents();
  return names.map((n) => n.trim());
}

async function advance(page: Page, index: number) {
  await page.getByRole('button', { name: index === 9 ? 'Finish' : 'Next' }).click();
}

test('a Legend Round shows ten distinct Characters and ends with the Score', async ({ page }) => {
  await start(page, 'Legend');
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    const character = await shownCharacter(page);
    seen.push(character.id);
    const names = await choiceNames(page);
    expect(new Set(names).size).toBe(4);
    expect(names).toContain(character.name);
    await page.getByRole('button', { name: character.name, exact: true }).click();
    await advance(page, i);
  }
  expect(new Set(seen).size).toBe(10);
  await expect(page.getByTestId('score')).toHaveText('10/10');
  const listed = await page.getByTestId('round-character').allTextContents();
  const expected = seen.map((id) => characters.find((c) => c.id === id)!.name);
  expect(listed.map((n) => n.trim()).sort()).toEqual(expected.sort());
});

test('a wrong tap greys the button out and the right tap reveals without scoring', async ({
  page,
}) => {
  await start(page, 'Rookie');
  const character = await shownCharacter(page);
  const wrong = (await choiceNames(page)).find((n) => n !== character.name)!;

  await page.getByRole('button', { name: wrong, exact: true }).click();
  await expect(page.getByRole('button', { name: wrong, exact: true })).toBeDisabled();
  await expect(page.getByTestId('reveal')).toHaveCount(0);

  await page.getByRole('button', { name: character.name, exact: true }).click();
  await expect(page.getByTestId('reveal')).toContainText(character.name);
  await advance(page, 0);

  for (let i = 1; i < 10; i++) {
    const next = await shownCharacter(page);
    await page.getByRole('button', { name: next.name, exact: true }).click();
    await advance(page, i);
  }
  await expect(page.getByTestId('score')).toHaveText('9/10');
});

test('Pro Rounds only use Rookie and Pro Characters', async ({ page }) => {
  for (let seed = 1; seed <= 3; seed++) {
    await start(page, 'Pro', seed);
    for (let i = 0; i < 10; i++) {
      const character = await shownCharacter(page);
      expect(character.tier).not.toBe('legend');
      for (const name of await choiceNames(page)) {
        const shown = characters.find((c) => c.name === name)!;
        expect(shown.tier).not.toBe('legend');
      }
      await page.getByRole('button', { name: character.name, exact: true }).click();
      await advance(page, i);
    }
  }
});

test.describe('Type mode', () => {
  async function startType(page: Page, seed = 1) {
    await page.goto(`/?seed=${seed}`);
    await page.getByLabel('Type').check();
    await page.getByRole('button', { name: 'Play' }).click();
  }

  test('the text field turns off phone keyboard helpers', async ({ page }) => {
    await startType(page);
    const field = page.getByRole('textbox');
    await expect(field).toHaveAttribute('autocapitalize', 'none');
    await expect(field).toHaveAttribute('autocorrect', 'off');
    await expect(field).toHaveAttribute('autocomplete', 'off');
    await expect(field).toHaveAttribute('spellcheck', 'false');
    await expect(page.getByTestId('choice')).toHaveCount(0);
  });

  test('wrong answers keep the Card open, Reveal forfeits, correct answers score', async ({
    page,
  }) => {
    await startType(page);

    const first = await shownCharacter(page);
    await page.getByRole('textbox').fill('definitely wrong');
    await page.getByRole('button', { name: 'Guess' }).click();
    await expect(page.getByTestId('reveal')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reveal' }).click();
    await expect(page.getByTestId('reveal')).toContainText(first.name);
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await advance(page, 0);

    for (let i = 1; i < 10; i++) {
      const character = await shownCharacter(page);
      const typed = i % 2 === 0 ? character.name.toUpperCase() : character.name.replace(/\W/g, '');
      await page.getByRole('textbox').fill(typed);
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('reveal')).toContainText(character.name);
      await advance(page, i);
    }
    await expect(page.getByTestId('score')).toHaveText('9/10');
  });

  test('Aliases are accepted', async ({ page }) => {
    for (let seed = 1; seed < 40; seed++) {
      await startType(page, seed);
      const character = await shownCharacter(page);
      if (character.aliases.length === 0) {
        await page.goto('/');
        continue;
      }
      await page.getByRole('textbox').fill(character.aliases[0]!);
      await page.getByRole('button', { name: 'Guess' }).click();
      await expect(page.getByTestId('reveal')).toContainText(character.name);
      return;
    }
    throw new Error('no seed shows a Character with an Alias first');
  });
});

test.describe('Remembered settings and best Scores', () => {
  async function playRound(page: Page, correct: number) {
    for (let i = 0; i < 10; i++) {
      const character = await shownCharacter(page);
      if (i < correct) {
        await page.getByRole('button', { name: character.name, exact: true }).click();
      } else {
        const wrong = (await choiceNames(page)).find((n) => n !== character.name)!;
        await page.getByRole('button', { name: wrong, exact: true }).click();
        await page.getByRole('button', { name: character.name, exact: true }).click();
      }
      await advance(page, i);
    }
  }

  test('first visit selects Pick + Rookie and shows no best Scores', async ({ page }) => {
    await page.goto('/?seed=1');
    await expect(page.getByLabel('Pick')).toBeChecked();
    await expect(page.getByLabel('Rookie')).toBeChecked();
    await expect(page.getByTestId('best-score')).toHaveCount(0);
  });

  test('settings and best Scores persist per combination, and a lower Score does not replace the best', async ({
    page,
  }) => {
    await start(page, 'Pro');
    await playRound(page, 6);
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.getByLabel('Pro').check();
    await page.getByRole('button', { name: 'Play' }).click();
    await playRound(page, 8);
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.getByRole('button', { name: 'Play' }).click();
    await playRound(page, 5);
    await expect(page.getByTestId('score')).toHaveText('5/10');

    await page.getByRole('button', { name: 'Play again' }).click();
    await page.getByLabel('Legend').check();
    await page.getByRole('button', { name: 'Play' }).click();
    await playRound(page, 3);
    await page.getByRole('button', { name: 'Play again' }).click();

    await page.reload();
    await expect(page.getByLabel('Pick')).toBeChecked();
    await expect(page.getByLabel('Legend')).toBeChecked();
    await expect(page.getByTestId('best-score')).toHaveCount(2);
    await expect(page.getByTestId('best-score').filter({ hasText: 'Pick + Pro' })).toContainText(
      '8/10',
    );
    await expect(page.getByTestId('best-score').filter({ hasText: 'Pick + Legend' })).toContainText(
      '3/10',
    );
  });

  test('corrupt saved data falls back to the defaults and a Round still plays', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('unmasked:v1', '{broken'));
    await page.goto('/?seed=1');
    await expect(page.getByLabel('Rookie')).toBeChecked();
    await page.getByRole('button', { name: 'Play' }).click();
    await playRound(page, 10);
    await expect(page.getByTestId('score')).toHaveText('10/10');
  });

  test('storage that throws does not break the game', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('denied');
        },
      });
    });
    await page.goto('/?seed=1');
    await expect(page.getByLabel('Pick')).toBeChecked();
    await page.getByRole('button', { name: 'Play' }).click();
    await playRound(page, 10);
    await expect(page.getByTestId('score')).toHaveText('10/10');
  });
});

test.describe('Comic-book look and feel', () => {
  async function noHorizontalScroll(page: Page) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }

  async function inViewport(page: Page, locator: ReturnType<Page['locator']>) {
    const box = (await locator.boundingBox())!;
    const view = page.viewportSize()!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
  }

  test('the reveal shows a Hero or Villain badge for the Side', async ({ page }) => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12 && seen.size < 2; seed++) {
      await start(page, 'Legend', seed);
      for (let i = 0; i < 10; i++) {
        const character = await shownCharacter(page);
        await page.getByRole('button', { name: character.name, exact: true }).click();
        await expect(page.getByTestId('side-badge')).toHaveText(
          character.side === 'hero' ? 'Hero' : 'Villain',
        );
        seen.add(character.side);
        await advance(page, i);
      }
    }
    expect([...seen].sort()).toEqual(['hero', 'villain']);
  });

  test('a Pick Card fits the screen with no horizontal scrolling', async ({ page }) => {
    await start(page, 'Rookie');
    await noHorizontalScroll(page);
    await inViewport(page, page.getByTestId('card-frame'));
    for (const choice of await page.getByTestId('choice').all()) await inViewport(page, choice);
  });

  test('a Type Card fits the screen with the on-screen keyboard open', async ({ page }) => {
    await page.goto('/?seed=1');
    await page.getByLabel('Type').check();
    await page.getByRole('button', { name: 'Play' }).click();
    await page.setViewportSize({ width: 390, height: 460 });
    await page.getByRole('textbox').focus();
    await noHorizontalScroll(page);
    await inViewport(page, page.getByTestId('card-frame'));
    await inViewport(page, page.getByRole('textbox'));
    await inViewport(page, page.getByRole('button', { name: 'Guess' }));
    await inViewport(page, page.getByRole('button', { name: 'Reveal' }));
  });

  test('every screen is centred and the Picture keeps its 3:4 shape', async ({ page }) => {
    const view = () => page.viewportSize()!.width;
    const centred = async (locator: ReturnType<Page['locator']>) => {
      const box = (await locator.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - view() / 2)).toBeLessThanOrEqual(2);
    };
    await page.goto('/?seed=1');
    await centred(page.getByRole('main'));
    await page.getByRole('link', { name: 'About' }).click();
    await centred(page.getByRole('main'));
    await page.getByRole('link', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Play' }).click();
    await centred(page.getByRole('main'));
    const frame = (await page.getByTestId('card-frame').boundingBox())!;
    expect(frame.width / frame.height).toBeCloseTo(0.75, 1);
    await centred(page.getByTestId('card-frame'));
    for (let i = 0; i < 10; i++) {
      const character = await shownCharacter(page);
      await page.getByRole('button', { name: character.name, exact: true }).click();
      await advance(page, i);
    }
    await centred(page.getByRole('main'));
  });

  test('the About page credits Marvel and says this is an unofficial fan game', async ({
    page,
  }) => {
    await page.goto('/?seed=1');
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByText('belong to Marvel')).toBeVisible();
    await expect(page.getByText('unofficial fan game')).toBeVisible();
    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });

  test('a correct answer bursts, a wrong tap does not, and the Round end celebrates', async ({
    page,
  }) => {
    await start(page, 'Rookie');
    const first = await shownCharacter(page);
    const wrong = (await choiceNames(page)).find((n) => n !== first.name)!;
    await page.getByRole('button', { name: wrong, exact: true }).click();
    await expect(page.getByTestId('burst')).toHaveCount(0);
    await page.getByRole('button', { name: first.name, exact: true }).click();
    await expect(page.getByTestId('burst')).toBeVisible();
    await advance(page, 0);
    await expect(page.getByTestId('burst')).toHaveCount(0);
    for (let i = 1; i < 10; i++) {
      const character = await shownCharacter(page);
      await page.getByRole('button', { name: character.name, exact: true }).click();
      await advance(page, i);
    }
    await expect(page.getByTestId('celebration')).toBeVisible();
  });

  test('Type answers burst too', async ({ page }) => {
    await page.goto('/?seed=1');
    await page.getByLabel('Type').check();
    await page.getByRole('button', { name: 'Play' }).click();
    const character = await shownCharacter(page);
    await page.getByRole('textbox').fill(character.name);
    await page.getByRole('button', { name: 'Guess' }).click();
    await expect(page.getByTestId('burst')).toBeVisible();
  });
});
