# AGENTS.md — exa-cli

## Overview

`exa-cli` is a Node.js CLI that wraps the Exa search API for token-efficient web search. Single-file architecture. JSON input, formatted text output.

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
source ~/.zshrc && ./dist/cli.js '{"query":"test query","results":1}'
```

Verify: `exa-cli --help`, `exa-cli --version`

## Code Style

- TypeScript strict mode, ESM with Node16 resolution.
- Single-file CLI at `cli.ts` — keep it that way unless complexity demands splitting.
- No external dependencies (uses native `fetch`). Only dev deps for TypeScript.
- Named exports only, no default exports.
- camelCase for variables/functions, PascalCase for interfaces.

## Architecture

```text
cli.ts    # Everything: types, API client, formatter, input parser, CLI entry
```

Sections within cli.ts:
- **Types** — ExaInput, ExaResult, ExaResponse interfaces
- **API** — getApiKey(), buildRequestBody(), search()
- **Formatting** — formatResults() renders structured text output
- **Input Parsing** — readStdin(), parseInput() with validation
- **CLI** — main(), getVersion(), printHelp()

## Key Details

- Auth: `EXA_API_KEY` env var, passed as `x-api-key` header
- API endpoint: `POST https://api.exa.ai/search`
- Default: `type: "auto"`, `highlights` at 4000 chars, 5 results
- Deep search timeout: 120s. Standard search timeout: 30s.
- Content params nest under `contents` in the API request (Exa quirk — common mistake source)
- `fresh: true` maps to `contents.maxAgeHours: 0` (NOT `livecrawl: "always"` which is deprecated)

## Gotchas

- Exa API uses camelCase in JSON (e.g., `numResults`, `maxCharacters`, `maxAgeHours`).
- `category: "company"` and `category: "people"` do NOT support date filters or `excludeDomains`.
- `useAutoprompt` is deprecated — do not add it.
- `outputSchema` only works with `type: "deep"` or `type: "deep-reasoning"`.
- Content params (`text`, `highlights`, `summary`) must be nested under `contents` on the `/search` endpoint.

## Skill

The OCO skill lives at `skill/SKILL.md`. Install to `~/.config/opencode/skill/exa-cli/SKILL.md`.
