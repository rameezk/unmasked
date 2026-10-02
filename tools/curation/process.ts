import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  candidatesFile,
  characters,
  charactersFile,
  choicesFile,
  downloadsDir,
  MAX_PICTURES,
  publicDir,
  readJson,
  selectCharacters,
  USER_AGENT,
  type Candidate,
  type Choices,
} from './shared.ts';

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

async function download(url: string): Promise<string> {
  mkdirSync(downloadsDir, { recursive: true });
  const file = resolve(downloadsDir, createHash('sha256').update(url).digest('hex'));
  if (existsSync(file)) return file;
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

function toWebp(input: string, output: string): void {
  execFileSync('magick', [
    `${input}[0]`,
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

for (const { character, kept } of plan) {
  const entries: { file: string; style: string }[] = [];
  for (const [index, candidate] of kept.entries()) {
    const file = `pictures/${character.id}-${index + 1}.webp`;
    toWebp(await download(candidate.url), resolve(publicDir, file));
    const size = statSync(resolve(publicDir, file)).size;
    console.log(`${file}: ${Math.round(size / 1024)} KB`);
    entries.push({ file, style: choices[candidate.url]?.style ?? candidate.style });
  }

  const start = source.indexOf(`id: '${character.id}'`);
  const block = /pictures: \[[\s\S]*?\n {4}\],/;
  const tail = source.slice(start);
  if (start < 0 || !block.test(tail)) throw new Error(`Cannot find pictures of ${character.id}`);
  source = source.slice(0, start) + tail.replace(block, picturesBlock(entries));

  const current = characters.find((c) => c.id === character.id);
  for (const old of current?.pictures ?? []) {
    if (!entries.some((e) => e.file === old.file)) rmSync(resolve(publicDir, old.file), { force: true });
  }
}

writeFileSync(charactersFile, source);
console.log(`Updated ${plan.length} characters`);
