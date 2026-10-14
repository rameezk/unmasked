import { expect, test } from '@playwright/test';
import { characters } from '../src/characters/characters';

test.skip(({ isMobile }) => isMobile, 'responses do not depend on the device');

const picture = characters.flatMap((character) => character.pictures)[0]?.file ?? '';

const paths: [string, string][] = [
  ['the home page', '/'],
  ['a Picture', `/${picture}`],
  ['a missing path', '/no-such-path'],
];

for (const [name, path] of paths) {
  test(`${name} carries the security headers`, async ({ request }) => {
    const response = await request.get(path);

    const headers = response.headers();
    expect(headers['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
}
