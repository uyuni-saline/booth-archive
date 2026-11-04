# Development Guide

## Project scope

This repository contains a lightweight Tampermonkey userscript for BOOTH. Keep the distributed script directly installable without a build step unless the project grows enough to justify one.

## Source conventions

- Keep userscript metadata in `booth-archive.user.js` accurate when behavior or release versions change.
- Match both `booth.pm` and BOOTH shop subdomains.
- Prefer stable structured data such as the item card's `data-item` attribute over presentation-only CSS classes or text.
- BOOTH shop pages use `li.js-mount-point-shop-item-card`; the account dashboard uses `li.item-card.l-card` and exposes unavailable states as badge text.
- Preserve Japanese BOOTH labels where they make the UI easier to understand.
- Persist user-facing settings with Tampermonkey storage APIs.
- Account for dynamically inserted content and avoid duplicate controls or event handlers.

## Verification

Run both commands before committing:

```bash
npm test
npm run check
```

When a supplied page snapshot is available, also verify selectors and structured fields against that snapshot.

