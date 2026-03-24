<div align="center">

# exa-cli

**Web search that fits in a context window.**

[![npm version](https://img.shields.io/npm/v/%40opencode%2Fexa-cli?style=flat-square&labelColor=black)](https://www.npmjs.com/package/@opencode/exa-cli)
[![License](https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square)](LICENSE)

Token-efficient web search for AI agents, powered by [Exa](https://exa.ai)

</div>

---

## The Problem

AI agents that use `webfetch` to research topics dump entire web pages into their context window — 50K+ tokens of navigation chrome, sidebars, and footers just to extract 2K of useful information. This wastes context, increases cost, and degrades agent performance.

## The Fix

`exa-cli` returns only the relevant parts. Exa's `highlights` mode extracts the key excerpts from each page, delivering 10x fewer tokens with higher information density. One search call, clean results, minimal context cost.

```bash
exa-cli '{"query":"OpenAI embeddings API request schema and dimensions"}'
```

---

## Install

```bash
npm install -g @opencode/exa-cli
```

Or run directly:

```bash
npx @opencode/exa-cli '{"query":"..."}'
```

Set your API key:

```bash
export EXA_API_KEY=your-key-here  # get one at https://dashboard.exa.ai/api-keys
```

## Usage

JSON input via CLI argument or stdin:

```bash
# Search with highlights (default — token-efficient)
exa-cli '{"query":"Rust async runtime benchmarks 2026"}'

# Scoped to specific domains
exa-cli '{"query":"Ollama embedding API","domains":["ollama.com","github.com"]}'

# Summary mode for quick overviews
exa-cli '{"query":"WebGPU browser support status","content":"summary","results":3}'

# Deep search with structured output
exa-cli '{"query":"compare frontier AI models","type":"deep","schema":{"type":"object","required":["models"],"properties":{"models":{"type":"array","items":{"type":"object","required":["name","release_date"],"properties":{"name":{"type":"string"},"release_date":{"type":"string"}}}}}}}'

# Pipe via stdin
printf '%s' '{"query":"latest Node.js LTS"}' | exa-cli
```

## JSON Input

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `query` | string | **(required)** | Natural language search query |
| `type` | string | `"auto"` | `auto`, `fast`, `instant`, `deep`, `deep-reasoning` |
| `results` | number | `5` | Number of results (1-100) |
| `chars` | number | `4000` | Max characters for content |
| `content` | string | `"highlights"` | `highlights`, `text`, `summary` |
| `category` | string | — | `company`, `people`, `research paper`, `news`, `tweet`, `personal site`, `financial report` |
| `domains` | string[] | — | Only return results from these domains |
| `excludeDomains` | string[] | — | Exclude results from these domains |
| `startDate` | string | — | Published after (ISO date) |
| `endDate` | string | — | Published before (ISO date) |
| `fresh` | boolean | `false` | Force livecrawl for latest content |
| `schema` | object | — | JSON schema for structured deep search output |
| `systemPrompt` | string | — | Instructions for deep search |
| `contentQuery` | string | — | Custom query for highlight/summary selection |

## Content Modes

| Mode | Tokens | Best for |
|:-----|:-------|:---------|
| **highlights** | Low | Agent workflows, factual lookups, API docs |
| **summary** | Low | Quick overviews, condensed answers |
| **text** | High | Deep analysis requiring full page context |

## Agent Integration

An OpenCode / OCO skill file is included at `skill/SKILL.md`.

```bash
mkdir -p ~/.config/opencode/skill/exa-cli
cp skill/SKILL.md ~/.config/opencode/skill/exa-cli/SKILL.md
```

## Build From Source

```bash
git clone https://github.com/AidenGeunGeun/exa-cli.git
cd exa-cli
npm install
npm run build
```

## License

MIT
