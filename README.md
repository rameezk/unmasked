# unmasked

A game where players guess the names of superheroes and villains from pictures.

## Getting started

Everything runs inside the Nix devshell (`nix develop`, or direnv with `use flake`).

```sh
pnpm install
git config core.hooksPath .githooks
pnpm dev
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`.

Add `?seed=1` to the URL for a deterministic Round.

## Curating Pictures

One-off local tools, run by hand. Work files live in the git-ignored `curation/` directory. Every command takes optional Character ids and defaults to all Characters.

```sh
pnpm curate:candidates spider-man thor
pnpm curate:review spider-man thor
pnpm curate:process spider-man thor
```

Review at http://127.0.0.1:4321/ and keep up to three candidates per Character. Choices save as you click, so you can stop and reopen the page later. The processing script refuses more than three kept, writes 3:4 WebP files of about 50 KB to `public/pictures/` and updates the Pictures in `src/characters/characters.ts`.
