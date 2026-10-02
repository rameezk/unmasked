import {
  candidatesFile,
  readJson,
  selectCharacters,
  USER_AGENT,
  writeJson,
  type Candidate,
  type PictureStyle,
} from './shared.ts';

const WIKIS: { style: PictureStyle; host: string }[] = [
  { style: 'comic', host: 'marvel.fandom.com' },
  { style: 'movie', host: 'marvelcinematicuniverse.fandom.com' },
  { style: 'cartoon', host: 'marvelanimated.fandom.com' },
];

const PAGES_PER_WIKI = 2;
const CANDIDATES_PER_WIKI = 8;
const MIN_SIDE = 300;
const SKIP_TITLE = /logo|icon|flag|symbol|banner|badge|stub|placeholder|\.svg|\.gif/i;

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  mime: string;
}

interface QueryResponse {
  query?: {
    search?: { title: string }[];
    pages?: Record<string, { title: string; imageinfo?: ImageInfo[] }>;
  };
}

async function api(host: string, params: Record<string, string>): Promise<QueryResponse> {
  const url = new URL(`https://${host}/api.php`);
  for (const [key, value] of Object.entries({ action: 'query', format: 'json', ...params })) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${host}: HTTP ${response.status}`);
  await new Promise((done) => setTimeout(done, 300));
  return (await response.json()) as QueryResponse;
}

async function gather(
  characterId: string,
  name: string,
  style: PictureStyle,
  host: string,
): Promise<Candidate[]> {
  const search = await api(host, { list: 'search', srsearch: name, srlimit: String(PAGES_PER_WIKI) });
  const titles = (search.query?.search ?? []).map((hit) => hit.title);
  const found: Candidate[] = [];
  for (const title of titles) {
    const images = await api(host, {
      generator: 'images',
      titles: title,
      gimlimit: '50',
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
    });
    const source = `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    for (const page of Object.values(images.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
      if (info.width < MIN_SIDE || info.height < MIN_SIDE) continue;
      if (SKIP_TITLE.test(page.title)) continue;
      if (found.some((c) => c.url === info.url)) continue;
      found.push({
        characterId,
        style,
        url: info.url,
        title: page.title.replace(/^File:/, ''),
        source,
        width: info.width,
        height: info.height,
      });
    }
  }
  const portraitFirst = (c: Candidate) => (c.height >= c.width * 0.9 ? 0 : 1);
  return found.sort((a, b) => portraitFirst(a) - portraitFirst(b)).slice(0, CANDIDATES_PER_WIKI);
}

const selected = selectCharacters(process.argv.slice(2));
const selectedIds = new Set(selected.map((c) => c.id));
const kept = readJson<Candidate[]>(candidatesFile, []).filter((c) => !selectedIds.has(c.characterId));
const fresh: Candidate[] = [];

for (const character of selected) {
  for (const { style, host } of WIKIS) {
    try {
      const found = await gather(character.id, character.name, style, host);
      fresh.push(...found);
      console.log(`${character.id} ${style}: ${found.length} candidates`);
    } catch (error) {
      console.error(`${character.id} ${style}: ${(error as Error).message}`);
    }
  }
}

writeJson(candidatesFile, [...kept, ...fresh]);
console.log(`Recorded ${fresh.length} candidates for ${selected.length} characters`);
