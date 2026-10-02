import { createServer, type IncomingMessage } from 'node:http';
import {
  candidatesFile,
  choicesFile,
  characters,
  isPictureStyle,
  PICTURE_STYLES,
  readJson,
  selectCharacters,
  writeJson,
  type Candidate,
  type Choices,
} from './shared.ts';

const PORT = 4321;
const MAX_BODY = 10_000;

const selected = selectCharacters(process.argv.slice(2));
const selectedIds = new Set(selected.map((c) => c.id));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>unmasked - review pictures</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 1200px; padding: 1rem; background: #fafafa; }
  h2 { margin: 2rem 0 0.5rem; }
  .row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .card { width: 210px; background: #fff; border: 3px solid #ccc; border-radius: 8px; padding: 0.5rem; }
  .card.keep { border-color: #1a9c3c; }
  .card.drop { opacity: 0.4; }
  .frame { width: 100%; aspect-ratio: 3 / 4; overflow: hidden; background: #eee; }
  .frame img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .meta { font-size: 0.75rem; word-break: break-word; margin: 0.25rem 0; }
  .controls { display: flex; gap: 0.25rem; }
  button, select { font: inherit; padding: 0.25rem 0.5rem; }
  .keep-count { font-weight: normal; font-size: 0.9rem; color: #555; }
  .over { color: #c00; }
  #status { position: fixed; top: 0.5rem; right: 0.5rem; background: #fff; padding: 0.25rem 0.5rem; border: 1px solid #ccc; }
</style>
</head>
<body>
<div id="status"></div>
<h1>Review pictures</h1>
<div id="root">Loading...</div>
<script>
  const root = document.getElementById('root');
  const status = document.getElementById('status');
  let state;

  async function save(url) {
    const choice = state.choices[url];
    const response = await fetch('/api/choice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, ...choice }),
    });
    status.textContent = response.ok ? 'Saved' : 'Save failed';
  }

  function thumb(url) {
    return url.includes('/revision/latest') ? url.replace(/\\/revision\\/latest.*$/, '/revision/latest/scale-to-width-down/300') : url;
  }

  function render() {
    root.textContent = '';
    for (const character of state.characters) {
      const items = state.candidates.filter((c) => c.characterId === character.id);
      const kept = items.filter((c) => state.choices[c.url]?.decision === 'keep').length;
      const heading = document.createElement('h2');
      heading.textContent = character.name + ' ';
      const count = document.createElement('span');
      count.className = 'keep-count' + (kept > state.max ? ' over' : '');
      count.textContent = kept + ' kept (max ' + state.max + ')';
      heading.append(count);
      root.append(heading);
      const row = document.createElement('div');
      row.className = 'row';
      for (const candidate of items) {
        const choice = state.choices[candidate.url] ?? { decision: undefined, style: candidate.style };
        const card = document.createElement('div');
        card.className = 'card ' + (choice.decision ?? '');
        const frame = document.createElement('div');
        frame.className = 'frame';
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.src = thumb(candidate.url);
        img.alt = candidate.title;
        frame.append(img);
        const meta = document.createElement('div');
        meta.className = 'meta';
        const link = document.createElement('a');
        link.href = candidate.source;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = candidate.title + ' (' + candidate.width + 'x' + candidate.height + ')';
        meta.append(link);
        const controls = document.createElement('div');
        controls.className = 'controls';
        for (const decision of ['keep', 'drop']) {
          const button = document.createElement('button');
          button.textContent = decision;
          button.onclick = () => {
            state.choices[candidate.url] = { decision, style: choice.style };
            save(candidate.url);
            render();
          };
          controls.append(button);
        }
        const select = document.createElement('select');
        for (const style of state.styles) {
          const option = document.createElement('option');
          option.value = style;
          option.textContent = style;
          option.selected = style === choice.style;
          select.append(option);
        }
        select.onchange = () => {
          state.choices[candidate.url] = { decision: choice.decision ?? 'drop', style: select.value };
          save(candidate.url);
          render();
        };
        controls.append(select);
        card.append(frame, meta, controls);
        row.append(card);
      }
      root.append(row);
    }
    const total = state.candidates.length;
    const decided = state.candidates.filter((c) => state.choices[c.url]).length;
    status.textContent = decided + ' / ' + total + ' reviewed';
  }

  fetch('/api/state').then((r) => r.json()).then((s) => { state = s; render(); });
</script>
</body>
</html>
`;

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY) {
        reject(new Error('body too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolveBody(body));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const send = (status: number, type: string, body: string) => {
    response.writeHead(status, { 'content-type': type });
    response.end(body);
  };
  try {
    if (request.method === 'GET' && request.url === '/') {
      send(200, 'text/html; charset=utf-8', page);
    } else if (request.method === 'GET' && request.url === '/api/state') {
      const candidates = readJson<Candidate[]>(candidatesFile, []).filter((c) =>
        selectedIds.has(c.characterId),
      );
      const withCandidates = new Set(candidates.map((c) => c.characterId));
      send(
        200,
        'application/json',
        JSON.stringify({
          characters: characters.filter((c) => withCandidates.has(c.id)),
          candidates,
          choices: readJson<Choices>(choicesFile, {}),
          styles: PICTURE_STYLES,
          max: 3,
        }),
      );
    } else if (request.method === 'POST' && request.url === '/api/choice') {
      const body = JSON.parse(await readBody(request)) as {
        url?: unknown;
        decision?: unknown;
        style?: unknown;
      };
      const known = readJson<Candidate[]>(candidatesFile, []).some((c) => c.url === body.url);
      if (
        !known ||
        typeof body.url !== 'string' ||
        (body.decision !== 'keep' && body.decision !== 'drop') ||
        !isPictureStyle(body.style)
      ) {
        send(400, 'text/plain', 'invalid choice');
        return;
      }
      const choices = readJson<Choices>(choicesFile, {});
      choices[body.url] = { decision: body.decision, style: body.style };
      writeJson(choicesFile, choices);
      send(200, 'application/json', '{}');
    } else {
      send(404, 'text/plain', 'not found');
    }
  } catch {
    send(400, 'text/plain', 'bad request');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Review page: http://127.0.0.1:${PORT}/`);
});
