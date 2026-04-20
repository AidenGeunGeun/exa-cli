# AGENTS.md - exa-cli

## Overview

`exa-cli` is a Node.js CLI that wraps the Exa search API for token-efficient web research. It supports both fast lookup and Exa's deeper synthesis modes, but it remains a single-file CLI with JSON input and formatted text output.

## Setup

```bash
npm install
npm run build    # TypeScript -> dist/
```

## Commands

```bash
npm run build        # compile TypeScript to dist/
npm run typecheck    # tsc --noEmit
npm run clean        # remove dist/
```

## Testing

No test suite yet. Manual testing:

```bash
./dist/cli.js '{"query":"test query","results":1}'
```

Also verify: `exa-cli --help`, `exa-cli --version`, stdin piping.

## Code Style

- TypeScript strict mode, ESM with Node16 resolution.
- Single-file CLI at `cli.ts` - keep it that way unless complexity truly forces a split.
- No external dependencies (uses native `fetch`). Only dev deps for TypeScript.
- Named exports only, no default exports.
- camelCase for variables/functions, PascalCase for interfaces.

## Architecture

```text
cli.ts    # Everything: types, validation, API client, formatter, input parser, CLI entry
```

Sections within `cli.ts`:
- **Types** - `ExaInput`, `ExaResult`, `ExaResponse`
- **Validation helpers** - runtime checks for JSON input
- **API** - `getApiKey()`, `buildRequestBody()`, `search()`
- **Formatting** - `formatResults()` renders structured text output
- **Input Parsing** - `readStdin()`, `parseInput()`
- **CLI** - `main()`, `getVersion()`, `printHelp()`

## Key Details

- Auth: `EXA_API_KEY` env var, passed as `x-api-key` header.
- API endpoint: `POST https://api.exa.ai/search`.
- Defaults: `type: "auto"`, `content: "highlights"`, `chars: 4000`, `results: 10`.
- Deep search timeout: 120s for `deep-lite`, `deep`, `deep-reasoning`. Standard search timeout: 30s.
- Content params always nest under `contents` on `/search`.
- `content` can be a single mode or an array such as `["highlights", "text"]`.
- `fresh: true` maps to `contents.maxAgeHours: 0`; explicit `maxAgeHours` takes precedence.
- `additionalQueries` is a top-level API field.
- `outputSchema` and `systemPrompt` work on all search types, not just deep.
- `synthOnly` is CLI-only formatter behavior. Never send it to Exa.

## Gotchas

- Exa API uses camelCase in JSON (for example `numResults`, `maxCharacters`, `maxAgeHours`).
- `category: "company"` and `category: "people"` do not support date filters or `excludeDomains`.
- `useAutoprompt` is deprecated - do not add it.
- `highlightScores` is deprecated/removed - do not read or render it.
- `tweet` is not a valid category.
- `outputSchema` now works with `auto`, `fast`, `instant`, `deep-lite`, `deep`, and `deep-reasoning`.
- Content params (`highlights`, `text`, `summary`, `maxAgeHours`) must be nested under `contents` on the `/search` endpoint.

## Skill

The OCO skill lives at `skill/SKILL.md`. Install to `~/.config/opencode/skill/exa-cli/SKILL.md`.
