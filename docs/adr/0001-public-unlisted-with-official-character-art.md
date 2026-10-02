# 0001. Public unlisted site using copyrighted character art

## Status

Accepted

## Context

The game shows Marvel characters, whose names and artwork are copyrighted. It is mainly a family game for a 4 year old, but grandparents and friends should be able to open it without friction. The art mixes comic, movie and cartoon images, chosen per character for recognisability.

- Option 1: Private behind Cloudflare Access. Lowest copyright exposure, but everyone needs an email login.
- Option 2: Public but unlisted. Anyone with the link can play. Copyright exposure is low but not zero.
- Option 3: Public and promoted, with fan-made or generated art instead of official art. Safer legally, but characters become harder to recognise.

## Decision

We will go with Option 2. There is no authentication and the site is not promoted. Marvel is credited and its official CDN is not hotlinked.

## Consequences

Family members can play straight from a link. If the site gets wider exposure or a takedown request arrives, we will put it behind Cloudflare Access (Option 1), which needs no code changes.
