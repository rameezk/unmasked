import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import {
  candidatesFile,
  characters,
  charactersFile,
  choicesFile,
  downloadsDir,
  FETCH_TIMEOUT_MS,
  isImageUrl,
  isPictureStyle,
  MAX_DOWNLOAD_BYTES,
  MAX_PICTURES,
  publicDir,
  readJson,
  selectCharacters,
  USER_AGENT,
  type Candidate,
  type Choices,
} from './shared.ts';

const MAX_REDIRECTS = 5;
const WIDTH = 600;
const HEIGHT = 800;
const TARGET_BYTES = 50 * 1024;

const selected = selectCharacters(process.argv.slice(2));
const candidates = readJson<Candidate[]>(candidatesFile, []);
const choices = readJson<Choices>(choicesFile, {});

const plan = selected
  .map((character) => ({
    character,
    kept: candidates.filter(
      (c) => c.characterId === character.id && choices[c.url]?.decision === 'keep',
    ),
  }))
  .filter((entry) => entry.kept.length > 0);

const tooMany = plan.filter((entry) => entry.kept.length > MAX_PICTURES);
if (tooMany.length > 0) {
  for (const { character, kept } of tooMany) {
    console.error(
      `${character.id}: ${kept.length} kept, at most ${MAX_PICTURES} allowed. Drop some on the review page.`,
    );
  }
  process.exit(1);
}

if (plan.length === 0) {
  console.log('Nothing kept for the selected characters');
  process.exit(0);
}

async function fetchFollowing(start: string): Promise<Response> {
  let current = start;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    if (!isImageUrl(current)) throw new Error(`Refusing to download ${current}`);
    const response = await fetch(current, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return response;
    current = new URL(location, current).toString();
  }
  throw new Error(`Too many redirects for ${start}`);
}

async function download(url: string): Promise<string> {
  mkdirSync(downloadsDir, { recursive: true });
  const file = resolve(downloadsDir, createHash('sha256').update(url).digest('hex'));
  if (existsSync(file)) return file;
  if (!isImageUrl(url)) throw new Error(`Refusing to download ${url}`);
  const response = await fetchFollowing(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_DOWNLOAD_BYTES) throw new Error(`Too large: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error(`Too large: ${url}`);
  if (!sniff(bytes)) throw new Error(`Not a jpeg, png or webp image: ${url}`);
  const partial = `${file}.partial`;
  writeFileSync(partial, bytes);
  renameSync(partial, file);
  return file;
}

function sniff(bytes: Buffer): 'jpeg' | 'png' | 'webp' | undefined {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpeg';
  if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
    return 'webp';
  return undefined;
}

function toWebp(input: string, output: string): void {
  const format = sniff(readFileSync(input));
  if (!format) throw new Error(`Not a jpeg, png or webp image: ${input}`);
  execFileSync('magick', [
    '-limit',
    'memory',
    '256MiB',
    '-limit',
    'map',
    '512MiB',
    '-limit',
    'area',
    '64MP',
    `${format}:${input}[0]`,
    '-auto-orient',
    '-resize',
    `${WIDTH}x${HEIGHT}^`,
    '-gravity',
    'north',
    '-extent',
    `${WIDTH}x${HEIGHT}`,
    '+repage',
    '-strip',
    '-define',
    `webp:target-size=${TARGET_BYTES}`,
    output,
  ]);
}

function picturesBlock(files: { file: string; style: string }[]): string {
  const lines = files.map((p) => `      { file: '${p.file}', style: '${p.style}' },`);
  return `pictures: [\n${lines.join('\n')}\n    ],`;
}

let source = readFileSync(charactersFile, 'utf8');
const obsolete: string[] = [];

for (const { character, kept } of plan) {
  const entries: { file: string; style: string }[] = [];
  for (const [index, candidate] of kept.entries()) {
    const file = `pictures/${character.id}-${index + 1}.webp`;
    toWebp(await download(candidate.url), resolve(publicDir, file));
    const size = statSync(resolve(publicDir, file)).size;
    console.log(`${file}: ${Math.round(size / 1024)} KB`);
    const style = choices[candidate.url]?.style;
    if (!isPictureStyle(style)) throw new Error(`Invalid style for ${candidate.url}`);
    entries.push({ file, style });
  }

  const start = source.indexOf(`id: '${character.id}'`);
  const block = /pictures: \[[\s\S]*?\n {4}\],/;
  const tail = source.slice(start);
  if (start < 0 || !block.test(tail)) throw new Error(`Cannot find pictures of ${character.id}`);
  source = source.slice(0, start) + tail.replace(block, picturesBlock(entries));

  const current = characters.find((c) => c.id === character.id);
  for (const old of current?.pictures ?? []) {
    if (!entries.some((e) => e.file === old.file)) obsolete.push(old.file);
  }
}

writeFileSync(charactersFile, source);
for (const file of obsolete) rmSync(resolve(publicDir, file), { force: true });
console.log(`Updated ${plan.length} characters`);
