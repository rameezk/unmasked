import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { characters } from '../../src/characters/characters.ts';
import { PICTURE_STYLES, type PictureStyle } from '../../src/engine/types.ts';

export { characters, PICTURE_STYLES };
export type { PictureStyle };

export const root = resolve(import.meta.dirname, '../..');
export const dataDir = resolve(root, 'curation');
export const downloadsDir = resolve(dataDir, 'downloads');
export const publicDir = resolve(root, 'public');
export const charactersFile = resolve(root, 'src/characters/characters.ts');
export const candidatesFile = resolve(dataDir, 'candidates.json');
export const choicesFile = resolve(dataDir, 'choices.json');

export const MAX_PICTURES = 3;
export const FETCH_TIMEOUT_MS = 30_000;
export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
export const IMAGE_HOSTS = /(^|\.)(wikia\.nocookie\.net|fandom\.com)$/;
export const USER_AGENT = 'unmasked-curation/1.0 (personal family game; manual curation)';

export interface Candidate {
  characterId: string;
  style: PictureStyle;
  url: string;
  title: string;
  source: string;
  width: number;
  height: number;
}

export interface Choice {
  decision: 'keep' | 'drop';
  style: PictureStyle;
}

export type Choices = Record<string, Choice>;

export function isImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && IMAGE_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
}

export function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, value: unknown): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function selectCharacters(ids: string[]) {
  if (ids.length === 0) return characters;
  const unknown = ids.filter((id) => !characters.some((c) => c.id === id));
  if (unknown.length > 0) {
    console.error(`Unknown character ids: ${unknown.join(', ')}`);
    process.exit(1);
  }
  return characters.filter((c) => ids.includes(c.id));
}

export function isPictureStyle(value: unknown): value is PictureStyle {
  return (PICTURE_STYLES as readonly unknown[]).includes(value);
}
