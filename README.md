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
