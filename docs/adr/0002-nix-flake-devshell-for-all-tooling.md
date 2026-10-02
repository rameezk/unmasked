# 0002. Nix flake devshell for all tooling

## Status

Accepted

## Context

Tickets are built by an automated software factory as well as by hand, so every builder needs the same toolchain (Node, pnpm, Playwright browsers, wrangler, image tools) without manual setup.

- Option 1: Rely on whatever is installed on the machine, plus a version file such as `.nvmrc`. Simple, but builds drift between machines and the factory.
- Option 2: A Nix flake whose devshell provides every tool the project needs, also used in CI. Reproducible everywhere, at the cost of Nix knowledge and pinning tools like Playwright browsers to the nixpkgs versions.
- Option 3: A dev container. Reproducible, but heavier, and the factory does not run on containers.

## Decision

We will go with Option 2: any tool the project needs comes from the flake's devshell, and CI runs inside the same devshell.

## Consequences

Builders only need Nix (and optionally direnv) to work on any ticket. Tools that npm would normally download, such as Playwright browsers, must come from nixpkgs, and their npm package versions must match the nixpkgs ones.
