import { expect, test } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'responses do not depend on the device');

test('robots.txt allows crawling and denies search and AI use', async ({ request }) => {
  const response = await request.get('/robots.txt');

  expect(response.status()).toBe(200);
  const lines = (await response.text()).split('\n').map((line) => line.trim());
  expect(lines).toContain('User-agent: *');
  expect(lines).toContain('Content-Signal: search=no, ai-input=no, ai-train=no');
  expect(lines).toContain('Allow: /');
  expect(lines.filter((line) => /^disallow\s*:/i.test(line))).toEqual([]);
});
